import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { currentStockBase, deductStock, receiveStock } from "../db/stock";
import { ApiError } from "../utils/api-error";
import { authenticatedUserId } from "../utils/auth-context";
import { asyncHandler } from "../utils/async-handler";

interface InventoryRow extends RowDataPacket {
  id: number;
  sku: string;
  name: string;
  categoryName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  price: number;
  stockValue: number;
  status: "out" | "low" | "normal";
  updatedAt: Date | null;
}

interface InventoryStatsRow extends RowDataPacket {
  totalStockValue: number;
  productCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface MovementRow extends RowDataPacket {
  id: number;
  productId: number;
  productName: string;
  movementType: string;
  quantity: number;
  note: string | null;
  createdAt: Date;
}

const movementTypes = ["opening", "purchase", "adjustment", "return"] as const;
type MovementType = typeof movementTypes[number];

export const inventoryRouter = Router();

inventoryRouter.get("/movements", asyncHandler(async (request, response) => {
  const requestedLimit = Number(request.query.limit ?? 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;
  const [movements] = await pool.query<MovementRow[]>(`
    SELECT
      sm.movement_id AS id,
      pb.product_id AS productId,
      p.product_name AS productName,
      CASE sm.movement_type
        WHEN 'IN' THEN 'purchase'
        WHEN 'OUT' THEN 'sale'
        WHEN 'ADJUSTMENT' THEN 'adjustment'
        ELSE 'adjustment'
      END AS movementType,
      sm.quantity_base AS quantity,
      sm.reference_no AS note,
      sm.moved_at AS createdAt
    FROM stock_movements sm
    INNER JOIN product_batches pb ON pb.batch_id = sm.batch_id
    INNER JOIN products p ON p.product_id = pb.product_id
    ORDER BY sm.moved_at DESC, sm.movement_id DESC
    LIMIT ?
  `, [limit]);
  response.json({ success: true, data: movements });
}));

inventoryRouter.post("/movements", asyncHandler(async (request, response) => {
  const body = request.body as { productId?: unknown; movementType?: unknown; quantity?: unknown; note?: unknown };
  const productId = Number(body.productId);
  const quantity = Number(body.quantity);
  if (!Number.isInteger(productId) || productId <= 0) throw new ApiError(400, "รหัสสินค้าไม่ถูกต้อง");
  if (!movementTypes.includes(body.movementType as MovementType)) {
    throw new ApiError(400, "ประเภทการเคลื่อนไหวสต็อกไม่ถูกต้อง");
  }
  if (!Number.isFinite(quantity) || quantity === 0) {
    throw new ApiError(400, "จำนวนสต็อกต้องเป็นตัวเลขและต้องไม่เท่ากับ 0");
  }
  const movementType = body.movementType as MovementType;
  if (movementType !== "adjustment" && quantity < 0) {
    throw new ApiError(400, "การรับเข้าหรือคืนสินค้าต้องใช้จำนวนที่มากกว่า 0");
  }
  const note = typeof body.note === "string" && body.note.trim()
    ? body.note.trim().slice(0, 100)
    : null;
  const recordedBy = authenticatedUserId(response);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [products] = await connection.query<Array<RowDataPacket & { id: number }>>(`
      SELECT product_id AS id
      FROM products
      WHERE product_id = ? AND is_active = 1
      LIMIT 1
      FOR UPDATE
    `, [productId]);
    if (!products[0]) throw new ApiError(404, "ไม่พบสินค้า");

    let movementId: number;
    let stockQuantity: number;
    if (quantity > 0) {
      const received = await receiveStock(connection, {
        productId,
        quantityBase: quantity,
        recordedBy,
        reference: note,
        movementType: movementType === "adjustment" ? "ADJUSTMENT" : "IN",
      });
      movementId = received.movementId;
      stockQuantity = await currentStockBase(connection, productId);
    } else {
      const deducted = await deductStock(connection, {
        productId,
        quantityBase: Math.abs(quantity),
        recordedBy,
        reference: note,
        movementType: "ADJUSTMENT",
      });
      movementId = deducted.movementId;
      stockQuantity = deducted.stockQuantity;
    }

    await connection.commit();
    response.status(201).json({ success: true, data: { id: movementId, stockQuantity } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

inventoryRouter.get("/", asyncHandler(async (request, response) => {
  const status = typeof request.query.status === "string" ? request.query.status : "";
  const category = typeof request.query.category === "string" ? request.query.category.trim() : "";
  const conditions = ["p.is_active = 1"];
  const values: Array<string | number> = [];
  const stockExpression = "COALESCE(stock.stockQuantity, 0)";
  if (["out", "low", "normal"].includes(status)) {
    conditions.push(status === "out"
      ? `${stockExpression} <= 0`
      : status === "low"
        ? `${stockExpression} > 0 AND ${stockExpression} <= p.reorder_point`
        : `${stockExpression} > p.reorder_point`);
  }
  if (category) {
    conditions.push("(CAST(c.category_id AS CHAR) = ? OR c.category_name = ?)");
    values.push(category, category);
  }

  const [items] = await pool.query<InventoryRow[]>(`
    SELECT
      p.product_id AS id,
      p.sku,
      p.product_name AS name,
      c.category_name AS categoryName,
      ${stockExpression} AS stockQuantity,
      p.reorder_point AS lowStockThreshold,
      p.base_unit AS unit,
      COALESCE(pu.selling_price, 0) AS price,
      ROUND(
        ${stockExpression} * COALESCE(pu.selling_price / NULLIF(pu.conversion_factor, 0), 0),
        2
      ) AS stockValue,
      CASE
        WHEN ${stockExpression} <= 0 THEN 'out'
        WHEN ${stockExpression} <= p.reorder_point THEN 'low'
        ELSE 'normal'
      END AS status,
      stock.updatedAt
    FROM products p
    INNER JOIN categories c ON c.category_id = p.category_id
    LEFT JOIN product_units pu ON pu.product_unit_id = (
      SELECT pu2.product_unit_id
      FROM product_units pu2
      WHERE pu2.product_id = p.product_id AND pu2.is_active = 1
      ORDER BY pu2.is_default DESC, pu2.product_unit_id ASC
      LIMIT 1
    )
    LEFT JOIN (
      SELECT
        pb.product_id,
        SUM(CASE WHEN pb.status IN ('ACTIVE', 'NEAR_EXPIRY') THEN pb.quantity_remaining_base ELSE 0 END) AS stockQuantity,
        MAX(sm.moved_at) AS updatedAt
      FROM product_batches pb
      LEFT JOIN stock_movements sm ON sm.batch_id = pb.batch_id
      GROUP BY pb.product_id
    ) stock ON stock.product_id = p.product_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY FIELD(status, 'out', 'low', 'normal'), p.product_name ASC
  `, values);

  const [statsRows] = await pool.query<InventoryStatsRow[]>(`
    SELECT
      COALESCE(SUM(
        COALESCE(stock.stockQuantity, 0)
        * COALESCE(pu.selling_price / NULLIF(pu.conversion_factor, 0), 0)
      ), 0) AS totalStockValue,
      COUNT(*) AS productCount,
      COALESCE(SUM(COALESCE(stock.stockQuantity, 0) > 0 AND COALESCE(stock.stockQuantity, 0) <= p.reorder_point), 0) AS lowStockCount,
      COALESCE(SUM(COALESCE(stock.stockQuantity, 0) <= 0), 0) AS outOfStockCount
    FROM products p
    LEFT JOIN product_units pu ON pu.product_unit_id = (
      SELECT pu2.product_unit_id
      FROM product_units pu2
      WHERE pu2.product_id = p.product_id AND pu2.is_active = 1
      ORDER BY pu2.is_default DESC, pu2.product_unit_id ASC
      LIMIT 1
    )
    LEFT JOIN (
      SELECT product_id, SUM(quantity_remaining_base) AS stockQuantity
      FROM product_batches
      WHERE status IN ('ACTIVE', 'NEAR_EXPIRY')
      GROUP BY product_id
    ) stock ON stock.product_id = p.product_id
    WHERE p.is_active = 1
  `);
  response.json({ success: true, data: { items, stats: statsRows[0] } });
}));
