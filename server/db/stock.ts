import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { ApiError } from "../utils/api-error";

interface SupplierRow extends RowDataPacket {
  supplierId: number;
}

interface BatchRow extends RowDataPacket {
  batchId: number;
  remaining: number;
}

type StockMovementType = "IN" | "OUT" | "ADJUSTMENT" | "EXPIRED";

function referenceNumber(prefix: string) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

async function defaultSupplierId(connection: PoolConnection) {
  const [suppliers] = await connection.query<SupplierRow[]>(`
    SELECT supplier_id AS supplierId
    FROM suppliers
    WHERE supplier_name = ?
    ORDER BY supplier_id ASC
    LIMIT 1
    FOR UPDATE
  `, ["ผู้จำหน่ายทั่วไป"]);
  if (suppliers[0]) return suppliers[0].supplierId;

  const [result] = await connection.execute<ResultSetHeader>(`
    INSERT INTO suppliers (supplier_name)
    VALUES (?)
  `, ["ผู้จำหน่ายทั่วไป"]);
  return result.insertId;
}

export async function receiveStock(
  connection: PoolConnection,
  input: {
    productId: number;
    quantityBase: number;
    recordedBy: number;
    reference?: string | null;
    movementType?: Extract<StockMovementType, "IN" | "ADJUSTMENT">;
    unitCost?: number;
  },
) {
  const quantityBase = Number(input.quantityBase.toFixed(3));
  if (quantityBase <= 0) throw new ApiError(400, "จำนวนรับเข้าต้องมากกว่า 0");

  const supplierId = await defaultSupplierId(connection);
  const receiptNo = referenceNumber("GR");
  const lotNo = referenceNumber("LOT");
  const [receipt] = await connection.execute<ResultSetHeader>(`
    INSERT INTO goods_receipts (supplier_id, received_by, receipt_no, status)
    VALUES (?, ?, ?, 'CONFIRMED')
  `, [supplierId, input.recordedBy, receiptNo]);
  const [item] = await connection.execute<ResultSetHeader>(`
    INSERT INTO goods_receipt_items (receipt_id, product_id, quantity_base, unit_cost)
    VALUES (?, ?, ?, ?)
  `, [receipt.insertId, input.productId, quantityBase, input.unitCost ?? 0]);
  const [batch] = await connection.execute<ResultSetHeader>(`
    INSERT INTO product_batches (
      receipt_item_id, product_id, lot_no, received_date,
      quantity_received_base, quantity_remaining_base, status
    )
    VALUES (?, ?, ?, CURDATE(), ?, ?, 'ACTIVE')
  `, [item.insertId, input.productId, lotNo, quantityBase, quantityBase]);
  const [movement] = await connection.execute<ResultSetHeader>(`
    INSERT INTO stock_movements (
      batch_id, recorded_by, movement_type, quantity_base, reference_no
    )
    VALUES (?, ?, ?, ?, ?)
  `, [
    batch.insertId,
    input.recordedBy,
    input.movementType ?? "IN",
    quantityBase,
    input.reference ?? receiptNo,
  ]);

  return { movementId: movement.insertId, batchId: batch.insertId, receiptNo };
}

export async function deductStock(
  connection: PoolConnection,
  input: {
    productId: number;
    quantityBase: number;
    recordedBy: number;
    reference?: string | null;
    movementType?: Extract<StockMovementType, "OUT" | "ADJUSTMENT" | "EXPIRED">;
    saleItemId?: number | null;
  },
) {
  const requested = Number(input.quantityBase.toFixed(3));
  if (requested <= 0) throw new ApiError(400, "จำนวนตัดสต็อกต้องมากกว่า 0");

  const [batches] = await connection.query<BatchRow[]>(`
    SELECT batch_id AS batchId, quantity_remaining_base AS remaining
    FROM product_batches
    WHERE product_id = ?
      AND status IN ('ACTIVE', 'NEAR_EXPIRY')
      AND quantity_remaining_base > 0
    ORDER BY expiry_date IS NULL ASC, expiry_date ASC, received_date ASC, batch_id ASC
    FOR UPDATE
  `, [input.productId]);

  const available = Number(batches.reduce((sum, batch) => sum + Number(batch.remaining), 0).toFixed(3));
  if (available < requested) {
    throw new ApiError(409, "สต็อกสินค้าไม่เพียงพอ", { available, requested });
  }

  let remainingToDeduct = requested;
  let firstMovementId = 0;
  for (const batch of batches) {
    if (remainingToDeduct <= 0) break;
    const deducted = Math.min(Number(batch.remaining), remainingToDeduct);
    const nextRemaining = Number((Number(batch.remaining) - deducted).toFixed(3));
    await connection.execute(`
      UPDATE product_batches
      SET quantity_remaining_base = ?, status = IF(? <= 0, 'DEPLETED', status)
      WHERE batch_id = ?
    `, [nextRemaining, nextRemaining, batch.batchId]);
    const [movement] = await connection.execute<ResultSetHeader>(`
      INSERT INTO stock_movements (
        batch_id, recorded_by, sale_item_id, movement_type, quantity_base, reference_no
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      batch.batchId,
      input.recordedBy,
      input.saleItemId ?? null,
      input.movementType ?? "OUT",
      -deducted,
      input.reference ?? null,
    ]);
    if (!firstMovementId) firstMovementId = movement.insertId;
    remainingToDeduct = Number((remainingToDeduct - deducted).toFixed(3));
  }

  return { movementId: firstMovementId, stockQuantity: Number((available - requested).toFixed(3)) };
}

export async function currentStockBase(connection: PoolConnection, productId: number) {
  const [rows] = await connection.query<Array<RowDataPacket & { stockQuantity: number }>>(`
    SELECT COALESCE(SUM(quantity_remaining_base), 0) AS stockQuantity
    FROM product_batches
    WHERE product_id = ? AND status IN ('ACTIVE', 'NEAR_EXPIRY')
  `, [productId]);
  return Number(rows[0]?.stockQuantity ?? 0);
}
