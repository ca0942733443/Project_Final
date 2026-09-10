import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { authenticatedUserId } from "../utils/auth-context";
import { asyncHandler } from "../utils/async-handler";

type RecommendationStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

interface InventoryOrderRow extends RowDataPacket {
  id: number;
  orderNumber: string;
  orderDate: string;
  status: RecommendationStatus;
  note: string | null;
  createdByName: string;
  itemCount: number;
  totalQuantity: number;
  suggestedQuantity: number;
  supplierNames: string | null;
}

interface InventoryOrderDetailRow extends RowDataPacket {
  id: number;
  orderNumber: string;
  orderDate: string;
  status: RecommendationStatus;
  note: string | null;
  createdByName: string;
}

interface InventoryOrderItemRow extends RowDataPacket {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  categoryName: string;
  supplierName: string | null;
  unit: string;
  currentStock: number;
  reorderPoint: number;
  suggestedQuantity: number;
  approvedQuantity: number | null;
  historicalSalesQuantity: number;
}

const statuses: readonly RecommendationStatus[] = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"];

export const inventoryOrdersRouter = Router();

function normalizeStatus(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return "";
  const status = value.trim().toUpperCase() as RecommendationStatus;
  if (!statuses.includes(status)) throw new ApiError(400, "สถานะคำสั่งซื้อไม่ถูกต้อง");
  return status;
}

function positiveQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ApiError(400, "จำนวนสั่งซื้อต้องมากกว่า 0");
  return Number(quantity.toFixed(3));
}

function optionalNote(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim().slice(0, 500);
}

function orderNumberSql(alias = "r") {
  return `CONCAT('PO-', DATE_FORMAT(${alias}.recommendation_date, '%y%m%d'), '-', LPAD(${alias}.recommendation_id, 4, '0'))`;
}

inventoryOrdersRouter.get("/", asyncHandler(async (request, response) => {
  const status = normalizeStatus(request.query.status);
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const requestedLimit = Number(request.query.limit ?? 100);
  const requestedOffset = Number(request.query.offset ?? 0);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100;
  const offset = Number.isInteger(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (status) {
    conditions.push("r.status = ?");
    values.push(status);
  }
  if (search) {
    conditions.push(`(
      CAST(r.recommendation_id AS CHAR) LIKE ?
      OR r.note LIKE ?
      OR u.full_name LIKE ?
      OR EXISTS (
        SELECT 1
        FROM order_recommendation_items search_item
        INNER JOIN products search_product ON search_product.product_id = search_item.product_id
        WHERE search_item.recommendation_id = r.recommendation_id
          AND (search_product.product_name LIKE ? OR search_product.sku LIKE ?)
      )
    )`);
    const query = `%${search}%`;
    values.push(query, query, query, query, query);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [orders] = await pool.query<InventoryOrderRow[]>(`
    SELECT
      r.recommendation_id AS id,
      ${orderNumberSql()} AS orderNumber,
      DATE_FORMAT(r.recommendation_date, '%Y-%m-%d') AS orderDate,
      r.status,
      r.note,
      u.full_name AS createdByName,
      COUNT(ri.recommendation_item_id) AS itemCount,
      COALESCE(SUM(COALESCE(ri.approved_quantity_base, ri.suggested_quantity_base)), 0) AS totalQuantity,
      COALESCE(SUM(ri.suggested_quantity_base), 0) AS suggestedQuantity,
      GROUP_CONCAT(DISTINCT COALESCE(s.supplier_name, 'ผู้จำหน่ายทั่วไป') ORDER BY s.supplier_name SEPARATOR ', ') AS supplierNames
    FROM order_recommendations r
    INNER JOIN users u ON u.user_id = r.created_by
    LEFT JOIN order_recommendation_items ri ON ri.recommendation_id = r.recommendation_id
    LEFT JOIN products p ON p.product_id = ri.product_id
    LEFT JOIN suppliers s ON s.supplier_id = p.supplier_id
    ${where}
    GROUP BY r.recommendation_id, r.recommendation_date, r.status, r.note, u.full_name
    ORDER BY r.recommendation_date DESC, r.recommendation_id DESC
    LIMIT ? OFFSET ?
  `, [...values, limit, offset]);

  const [summaryRows] = await pool.query<Array<RowDataPacket & {
    totalOrders: number;
    draftCount: number;
    pendingApprovalCount: number;
    approvedCount: number;
    rejectedCount: number;
    totalQuantity: number;
  }>>(`
    SELECT
      COUNT(*) AS totalOrders,
      COALESCE(SUM(status = 'DRAFT'), 0) AS draftCount,
      COALESCE(SUM(status = 'PENDING_APPROVAL'), 0) AS pendingApprovalCount,
      COALESCE(SUM(status = 'APPROVED'), 0) AS approvedCount,
      COALESCE(SUM(status = 'REJECTED'), 0) AS rejectedCount,
      COALESCE((
        SELECT SUM(COALESCE(ri.approved_quantity_base, ri.suggested_quantity_base))
        FROM order_recommendation_items ri
        INNER JOIN order_recommendations summary_order ON summary_order.recommendation_id = ri.recommendation_id
        WHERE summary_order.status IN ('DRAFT', 'PENDING_APPROVAL')
      ), 0) AS totalQuantity
    FROM order_recommendations
  `);

  response.json({ success: true, data: { items: orders, summary: summaryRows[0] } });
}));

inventoryOrdersRouter.get("/:id", asyncHandler(async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "รหัสคำสั่งซื้อไม่ถูกต้อง");

  const [orders] = await pool.query<InventoryOrderDetailRow[]>(`
    SELECT
      r.recommendation_id AS id,
      ${orderNumberSql()} AS orderNumber,
      DATE_FORMAT(r.recommendation_date, '%Y-%m-%d') AS orderDate,
      r.status,
      r.note,
      u.full_name AS createdByName
    FROM order_recommendations r
    INNER JOIN users u ON u.user_id = r.created_by
    WHERE r.recommendation_id = ?
    LIMIT 1
  `, [id]);
  const order = orders[0];
  if (!order) throw new ApiError(404, "ไม่พบคำสั่งซื้อสินค้าคงคลัง");

  const [items] = await pool.query<InventoryOrderItemRow[]>(`
    SELECT
      ri.recommendation_item_id AS id,
      p.product_id AS productId,
      p.sku,
      p.product_name AS productName,
      c.category_name AS categoryName,
      s.supplier_name AS supplierName,
      p.base_unit AS unit,
      COALESCE(stock.stockQuantity, 0) AS currentStock,
      p.reorder_point AS reorderPoint,
      ri.suggested_quantity_base AS suggestedQuantity,
      ri.approved_quantity_base AS approvedQuantity,
      ri.historical_sales_qty_base AS historicalSalesQuantity
    FROM order_recommendation_items ri
    INNER JOIN products p ON p.product_id = ri.product_id
    INNER JOIN categories c ON c.category_id = p.category_id
    LEFT JOIN suppliers s ON s.supplier_id = p.supplier_id
    LEFT JOIN (
      SELECT product_id, SUM(quantity_remaining_base) AS stockQuantity
      FROM product_batches
      WHERE status IN ('ACTIVE', 'NEAR_EXPIRY')
      GROUP BY product_id
    ) stock ON stock.product_id = p.product_id
    WHERE ri.recommendation_id = ?
    ORDER BY ri.recommendation_item_id ASC
  `, [id]);

  response.json({ success: true, data: { ...order, items } });
}));

inventoryOrdersRouter.post("/", asyncHandler(async (request, response) => {
  const body = request.body as { note?: unknown; items?: Array<{ productId?: unknown; quantity?: unknown }> };
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new ApiError(400, "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
  }

  const quantities = new Map<number, number>();
  for (const item of body.items) {
    const productId = Number(item.productId);
    if (!Number.isInteger(productId) || productId <= 0) throw new ApiError(400, "รหัสสินค้าไม่ถูกต้อง");
    const quantity = positiveQuantity(item.quantity);
    quantities.set(productId, Number(((quantities.get(productId) ?? 0) + quantity).toFixed(3)));
  }

  const productIds = [...quantities.keys()];
  const placeholders = productIds.map(() => "?").join(",");
  const createdBy = authenticatedUserId(response);
  const note = optionalNote(body.note);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [products] = await connection.query<Array<RowDataPacket & { id: number }>>(`
      SELECT product_id AS id
      FROM products
      WHERE product_id IN (${placeholders}) AND is_active = 1
      FOR UPDATE
    `, productIds);
    if (products.length !== productIds.length) throw new ApiError(400, "มีสินค้าบางรายการไม่พบหรือถูกปิดใช้งาน");

    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO order_recommendations (created_by, recommendation_date, status, note)
      VALUES (?, CURDATE(), 'DRAFT', ?)
    `, [createdBy, note]);
    for (const [productId, quantity] of quantities) {
      await connection.execute(`
        INSERT INTO order_recommendation_items (
          recommendation_id, product_id, suggested_quantity_base,
          approved_quantity_base, historical_sales_qty_base
        )
        VALUES (?, ?, ?, NULL, 0)
      `, [result.insertId, productId, quantity]);
    }

    await connection.commit();
    response.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

inventoryOrdersRouter.patch("/:id", asyncHandler(async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "รหัสคำสั่งซื้อไม่ถูกต้อง");
  const body = request.body as { status?: unknown; note?: unknown };
  const requestedStatus = body.status === undefined ? "" : normalizeStatus(body.status);
  const noteProvided = body.note !== undefined;
  const note = noteProvided ? optionalNote(body.note) : null;
  if (!requestedStatus && !noteProvided) throw new ApiError(400, "ไม่มีข้อมูลสำหรับแก้ไข");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query<Array<RowDataPacket & { id: number; status: RecommendationStatus }>>(`
      SELECT recommendation_id AS id, status
      FROM order_recommendations
      WHERE recommendation_id = ?
      LIMIT 1
      FOR UPDATE
    `, [id]);
    const order = orders[0];
    if (!order) throw new ApiError(404, "ไม่พบคำสั่งซื้อสินค้าคงคลัง");

    if (requestedStatus) {
      await connection.execute(`UPDATE order_recommendations SET status = ? WHERE recommendation_id = ?`, [requestedStatus, id]);
      if (requestedStatus === "APPROVED") {
        await connection.execute(`
          UPDATE order_recommendation_items
          SET approved_quantity_base = suggested_quantity_base
          WHERE recommendation_id = ?
        `, [id]);
      }
    }
    if (noteProvided) {
      await connection.execute(`UPDATE order_recommendations SET note = ? WHERE recommendation_id = ?`, [note, id]);
    }

    await connection.commit();
    response.json({ success: true, data: { id, status: requestedStatus || order.status } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));
