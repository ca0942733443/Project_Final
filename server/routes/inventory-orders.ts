import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { authenticatedUserId } from "../utils/auth-context";
import { asyncHandler } from "../utils/async-handler";

type RecommendationStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "RECEIVED";

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
  goodsReceiptId: number | null;
  receiptNo: string | null;
  receivedAt: string | null;
  receivedByName: string | null;
}

interface InventoryOrderItemRow extends RowDataPacket {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  categoryName: string;
  supplierName: string | null;
  supplierId: number | null;
  unit: string;
  costPrice: number;
  currentStock: number;
  reorderPoint: number;
  suggestedQuantity: number;
  approvedQuantity: number | null;
  historicalSalesQuantity: number;
  receivedQuantity: number | null;
  receivedUnitCost: number | null;
  lotNo: string | null;
  batchReceivedDate: string | null;
  expiryDate: string | null;
}

interface ReceivableItemRow extends RowDataPacket {
  id: number;
  productId: number;
  supplierId: number | null;
  productName: string;
}

const statuses: readonly RecommendationStatus[] = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "RECEIVED"];

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

function nonNegativeMoney(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new ApiError(400, "ต้นทุนต่อหน่วยต้องไม่น้อยกว่า 0");
  return Number(amount.toFixed(2));
}

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || value.trim() === "") throw new ApiError(400, `กรุณาระบุ${label}`);
  const text = value.trim();
  if (text.length > maxLength) throw new ApiError(400, `${label}ยาวเกิน ${maxLength} ตัวอักษร`);
  return text;
}

function validDatePart(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function requiredDateTime(value: unknown) {
  if (typeof value !== "string") throw new ApiError(400, "กรุณาระบุวันที่และเวลารับสินค้า");
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match || !validDatePart(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] ?? 0) > 59) {
    throw new ApiError(400, "วันที่และเวลารับสินค้าไม่ถูกต้อง");
  }
  return `${match[1]} ${match[2]}:${match[3]}:${match[4] ?? "00"}`;
}

function optionalDate(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !validDatePart(value.trim())) throw new ApiError(400, "วันหมดอายุไม่ถูกต้อง");
  return value.trim();
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
    receivedCount: number;
    totalQuantity: number;
  }>>(`
    SELECT
      COUNT(*) AS totalOrders,
      COALESCE(SUM(status = 'DRAFT'), 0) AS draftCount,
      COALESCE(SUM(status = 'PENDING_APPROVAL'), 0) AS pendingApprovalCount,
      COALESCE(SUM(status = 'APPROVED'), 0) AS approvedCount,
      COALESCE(SUM(status = 'REJECTED'), 0) AS rejectedCount,
      COALESCE(SUM(status = 'RECEIVED'), 0) AS receivedCount,
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
      u.full_name AS createdByName,
      r.goods_receipt_id AS goodsReceiptId,
      gr.receipt_no AS receiptNo,
      DATE_FORMAT(gr.received_at, '%Y-%m-%dT%H:%i:%s') AS receivedAt,
      receiver.full_name AS receivedByName
    FROM order_recommendations r
    INNER JOIN users u ON u.user_id = r.created_by
    LEFT JOIN goods_receipts gr ON gr.receipt_id = r.goods_receipt_id
    LEFT JOIN users receiver ON receiver.user_id = gr.received_by
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
      p.supplier_id AS supplierId,
      p.base_unit AS unit,
      p.cost_price AS costPrice,
      COALESCE(stock.stockQuantity, 0) AS currentStock,
      p.reorder_point AS reorderPoint,
      ri.suggested_quantity_base AS suggestedQuantity,
      ri.approved_quantity_base AS approvedQuantity,
      ri.historical_sales_qty_base AS historicalSalesQuantity,
      gri.quantity_base AS receivedQuantity,
      gri.unit_cost AS receivedUnitCost,
      pb.lot_no AS lotNo,
      DATE_FORMAT(pb.received_date, '%Y-%m-%d') AS batchReceivedDate,
      DATE_FORMAT(pb.expiry_date, '%Y-%m-%d') AS expiryDate
    FROM order_recommendation_items ri
    INNER JOIN order_recommendations recommendation ON recommendation.recommendation_id = ri.recommendation_id
    INNER JOIN products p ON p.product_id = ri.product_id
    INNER JOIN categories c ON c.category_id = p.category_id
    LEFT JOIN suppliers s ON s.supplier_id = p.supplier_id
    LEFT JOIN goods_receipt_items gri
      ON gri.receipt_id = recommendation.goods_receipt_id
      AND gri.product_id = ri.product_id
    LEFT JOIN product_batches pb ON pb.receipt_item_id = gri.receipt_item_id
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

inventoryOrdersRouter.post("/:id/receive", asyncHandler(async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "รหัสคำสั่งซื้อไม่ถูกต้อง");
  const body = request.body as {
    receiptNo?: unknown;
    receivedAt?: unknown;
    items?: Array<{ itemId?: unknown; quantity?: unknown; unitCost?: unknown; lotNo?: unknown; expiryDate?: unknown }>;
  };
  if (!Array.isArray(body.items) || body.items.length === 0) throw new ApiError(400, "กรุณาระบุสินค้าที่รับเข้า");
  const receiptNo = requiredText(body.receiptNo, "เลขที่ใบรับสินค้า", 50);
  const receivedAt = requiredDateTime(body.receivedAt);
  const receivedDate = receivedAt.slice(0, 10);

  const receivedItems = new Map<number, { quantity: number; unitCost: number; lotNo: string; expiryDate: string | null }>();
  for (const item of body.items) {
    const itemId = Number(item.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0 || receivedItems.has(itemId)) {
      throw new ApiError(400, "รายการสินค้าที่รับเข้าไม่ถูกต้องหรือซ้ำกัน");
    }
    receivedItems.set(itemId, {
      quantity: positiveQuantity(item.quantity),
      unitCost: nonNegativeMoney(item.unitCost),
      lotNo: requiredText(item.lotNo, "เลขล็อตสินค้า", 100),
      expiryDate: optionalDate(item.expiryDate),
    });
  }
  for (const item of receivedItems.values()) {
    if (item.expiryDate && item.expiryDate < receivedDate) throw new ApiError(400, "วันหมดอายุต้องไม่ก่อนวันที่รับสินค้า");
  }

  const receivedBy = authenticatedUserId(response);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query<Array<RowDataPacket & {
      status: RecommendationStatus;
      goodsReceiptId: number | null;
      orderNumber: string;
    }>>(`
      SELECT status, goods_receipt_id AS goodsReceiptId, ${orderNumberSql()} AS orderNumber
      FROM order_recommendations r
      WHERE recommendation_id = ?
      LIMIT 1
      FOR UPDATE
    `, [id]);
    const order = orders[0];
    if (!order) throw new ApiError(404, "ไม่พบคำสั่งซื้อสินค้าคงคลัง");
    if (order.status === "RECEIVED" || order.goodsReceiptId) throw new ApiError(409, "PO นี้รับสินค้าเข้าสต็อกแล้ว");
    if (order.status !== "APPROVED") throw new ApiError(409, "ต้องอนุมัติ PO ก่อนรับสินค้าเข้าสต็อก");

    const [duplicateReceipts] = await connection.query<Array<RowDataPacket & { id: number }>>(`
      SELECT receipt_id AS id
      FROM goods_receipts
      WHERE receipt_no = ?
      LIMIT 1
      FOR UPDATE
    `, [receiptNo]);
    if (duplicateReceipts[0]) throw new ApiError(409, "เลขที่ใบรับสินค้านี้ถูกใช้งานแล้ว");

    const [items] = await connection.query<ReceivableItemRow[]>(`
      SELECT
        ri.recommendation_item_id AS id,
        p.product_id AS productId,
        p.supplier_id AS supplierId,
        p.product_name AS productName
      FROM order_recommendation_items ri
      INNER JOIN products p ON p.product_id = ri.product_id AND p.is_active = 1
      WHERE ri.recommendation_id = ?
      ORDER BY ri.recommendation_item_id
      FOR UPDATE
    `, [id]);
    if (!items.length || items.length !== receivedItems.size || items.some((item) => !receivedItems.has(item.id))) {
      throw new ApiError(400, "กรุณาระบุจำนวนรับจริงให้ครบทุกสินค้าใน PO");
    }

    const supplierKeys = new Set(items.map((item) => item.supplierId === null ? "general" : String(item.supplierId)));
    if (supplierKeys.size !== 1) throw new ApiError(409, "PO นี้มีสินค้าหลาย Supplier กรุณาแยก PO ตาม Supplier ก่อนรับเข้า");

    let supplierId = items[0].supplierId;
    if (supplierId === null) {
      const [generalSuppliers] = await connection.query<Array<RowDataPacket & { id: number }>>(`
        SELECT supplier_id AS id
        FROM suppliers
        WHERE supplier_name = 'ผู้จำหน่ายทั่วไป'
        ORDER BY supplier_id
        LIMIT 1
        FOR UPDATE
      `);
      supplierId = generalSuppliers[0]?.id ?? null;
      if (supplierId === null) {
        const [generalSupplier] = await connection.execute<ResultSetHeader>(`
          INSERT INTO suppliers (supplier_name) VALUES ('ผู้จำหน่ายทั่วไป')
        `);
        supplierId = generalSupplier.insertId;
      }
    }

    const [receipt] = await connection.execute<ResultSetHeader>(`
      INSERT INTO goods_receipts (supplier_id, received_by, receipt_no, received_at, status)
      VALUES (?, ?, ?, ?, 'CONFIRMED')
    `, [supplierId, receivedBy, receiptNo, receivedAt]);

    let totalQuantity = 0;
    let totalCost = 0;
    for (const item of items) {
      const received = receivedItems.get(item.id);
      if (!received) throw new ApiError(400, `ไม่พบจำนวนรับจริงของ ${item.productName}`);
      const [duplicateLots] = await connection.query<Array<RowDataPacket & { id: number }>>(`
        SELECT batch_id AS id
        FROM product_batches
        WHERE product_id = ? AND lot_no = ?
        LIMIT 1
        FOR UPDATE
      `, [item.productId, received.lotNo]);
      if (duplicateLots[0]) throw new ApiError(409, `เลขล็อต ${received.lotNo} ของ ${item.productName} ถูกใช้งานแล้ว`);
      const [receiptItem] = await connection.execute<ResultSetHeader>(`
        INSERT INTO goods_receipt_items (receipt_id, product_id, quantity_base, unit_cost)
        VALUES (?, ?, ?, ?)
      `, [receipt.insertId, item.productId, received.quantity, received.unitCost]);
      const nearExpiry = received.expiryDate
        ? (Date.parse(`${received.expiryDate}T00:00:00Z`) - Date.parse(`${receivedDate}T00:00:00Z`)) / 86_400_000 <= 7
        : false;
      const [batch] = await connection.execute<ResultSetHeader>(`
        INSERT INTO product_batches (
          receipt_item_id, product_id, lot_no, received_date, expiry_date,
          quantity_received_base, quantity_remaining_base, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        receiptItem.insertId,
        item.productId,
        received.lotNo,
        receivedDate,
        received.expiryDate,
        received.quantity,
        received.quantity,
        nearExpiry ? "NEAR_EXPIRY" : "ACTIVE",
      ]);
      await connection.execute(`
        INSERT INTO stock_movements (batch_id, recorded_by, movement_type, quantity_base, reference_no)
        VALUES (?, ?, 'IN', ?, ?)
      `, [batch.insertId, receivedBy, received.quantity, order.orderNumber]);
      await connection.execute("UPDATE products SET cost_price = ? WHERE product_id = ?", [received.unitCost, item.productId]);
      totalQuantity += received.quantity;
      totalCost += received.quantity * received.unitCost;
    }

    await connection.execute(`
      UPDATE order_recommendations
      SET status = 'RECEIVED', goods_receipt_id = ?
      WHERE recommendation_id = ?
    `, [receipt.insertId, id]);
    await connection.commit();
    response.status(201).json({
      success: true,
      data: {
        id,
        status: "RECEIVED",
        receiptId: receipt.insertId,
        receiptNo,
        totalQuantity: Number(totalQuantity.toFixed(3)),
        totalCost: Number(totalCost.toFixed(2)),
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

inventoryOrdersRouter.post("/", asyncHandler(async (request, response) => {
  const body = request.body as { note?: unknown; splitBySupplier?: unknown; items?: Array<{ productId?: unknown; quantity?: unknown }> };
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
  const splitBySupplier = body.splitBySupplier === true;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [products] = await connection.query<Array<RowDataPacket & { id: number; supplierId: number | null }>>(`
      SELECT product_id AS id, supplier_id AS supplierId
      FROM products
      WHERE product_id IN (${placeholders}) AND is_active = 1
      FOR UPDATE
    `, productIds);
    if (products.length !== productIds.length) throw new ApiError(400, "มีสินค้าบางรายการไม่พบหรือถูกปิดใช้งาน");

    const supplierByProduct = new Map(products.map((product) => [product.id, product.supplierId]));
    const groupedProductIds = new Map<string, number[]>();
    for (const productId of productIds) {
      const supplierId = supplierByProduct.get(productId) ?? null;
      const groupKey = splitBySupplier ? (supplierId === null ? "general" : String(supplierId)) : "all";
      const group = groupedProductIds.get(groupKey) ?? [];
      group.push(productId);
      groupedProductIds.set(groupKey, group);
    }

    const recommendationIds: number[] = [];
    for (const groupedIds of groupedProductIds.values()) {
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO order_recommendations (created_by, recommendation_date, status, note)
        VALUES (?, CURDATE(), 'DRAFT', ?)
      `, [createdBy, note]);
      recommendationIds.push(result.insertId);
      for (const productId of groupedIds) {
        const quantity = quantities.get(productId);
        if (quantity === undefined) throw new ApiError(400, "ไม่พบจำนวนสินค้าที่ต้องการสั่ง");
        await connection.execute(`
          INSERT INTO order_recommendation_items (
            recommendation_id, product_id, suggested_quantity_base,
            approved_quantity_base, historical_sales_qty_base
          )
          VALUES (?, ?, ?, NULL, 0)
        `, [result.insertId, productId, quantity]);
      }
    }

    await connection.commit();
    response.status(201).json({ success: true, data: { id: recommendationIds.length === 1 ? recommendationIds[0] : null, ids: recommendationIds, count: recommendationIds.length } });
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
      if (requestedStatus === "RECEIVED") throw new ApiError(400, "กรุณารับสินค้าเข้าสต็อกผ่านขั้นตอนตรวจรับสินค้า");
      const allowedTransitions: Record<RecommendationStatus, RecommendationStatus[]> = {
        DRAFT: ["PENDING_APPROVAL"],
        PENDING_APPROVAL: ["APPROVED", "REJECTED"],
        APPROVED: [],
        REJECTED: ["DRAFT"],
        RECEIVED: [],
      };
      if (!allowedTransitions[order.status].includes(requestedStatus)) {
        throw new ApiError(409, "ไม่สามารถเปลี่ยนสถานะ PO ตามลำดับขั้นตอนนี้ได้");
      }
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
