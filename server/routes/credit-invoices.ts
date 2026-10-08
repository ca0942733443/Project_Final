import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { authenticatedUserId } from "../utils/auth-context";
import { asyncHandler } from "../utils/async-handler";
import { requireRoles } from "../middleware/auth";

type CreditInvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
type CreditPaymentMethod = "cash" | "qr" | "bank_transfer";

interface CreditInvoiceRow extends RowDataPacket {
  id: number;
  saleId: number;
  saleNumber: string;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  originalAmount: number;
  outstandingAmount: number;
  status: CreditInvoiceStatus;
  dueDate: string | null;
  createdAt: Date;
  itemCount: number;
}

interface CreditInvoiceDetailRow extends CreditInvoiceRow {
  cashierName: string;
  subtotal: number;
  discountAmount: number;
}

interface CreditInvoiceItemRow extends RowDataPacket {
  id: number;
  productId: number;
  productName: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

interface CreditInvoicePaymentRow extends RowDataPacket {
  id: number;
  paidAmount: number;
  paymentMethod: "CASH" | "QR_CODE" | "BANK_TRANSFER";
  referenceNumber: string | null;
  paidAt: Date;
  receivedByName: string;
}

interface CreditInvoiceForPayment extends RowDataPacket {
  id: number;
  invoiceNumber: string;
  customerId: number;
  outstandingAmount: number;
  dueDate: Date | string | null;
  status: CreditInvoiceStatus;
}

const paymentMethods: Record<CreditPaymentMethod, "CASH" | "QR_CODE" | "BANK_TRANSFER"> = {
  cash: "CASH",
  qr: "QR_CODE",
  bank_transfer: "BANK_TRANSFER",
};

export const creditInvoicesRouter = Router();

function positiveId(value: unknown, fieldName: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, `${fieldName}ไม่ถูกต้อง`);
  return id;
}

function paymentAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "ยอดรับชำระต้องมากกว่า 0");
  return Number(amount.toFixed(2));
}

function paymentMethod(value: unknown): CreditPaymentMethod {
  const method = typeof value === "string" ? value.toLowerCase() : "";
  if (!Object.hasOwn(paymentMethods, method)) throw new ApiError(400, "ช่องทางรับชำระไม่ถูกต้อง");
  return method as CreditPaymentMethod;
}

function optionalReference(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim().slice(0, 100);
}

async function incomeCategoryId(connection: PoolConnection) {
  const [result] = await connection.execute<ResultSetHeader>(`
    INSERT INTO cash_categories (category_name, transaction_type, is_active)
    VALUES (?, 'INCOME', 1)
    ON DUPLICATE KEY UPDATE
      cash_category_id = LAST_INSERT_ID(cash_category_id),
      is_active = 1
  `, ["รายรับชำระหนี้"]);
  return result.insertId;
}

creditInvoicesRouter.get("/", asyncHandler(async (request, response) => {
  const customerId = request.query.customerId === undefined
    ? null
    : positiveId(request.query.customerId, "รหัสลูกค้า");
  const status = typeof request.query.status === "string" ? request.query.status.toLowerCase() : "open";
  if (!["open", "all", "paid", "overdue"].includes(status)) {
    throw new ApiError(400, "ตัวกรองสถานะใบหนี้ไม่ถูกต้อง");
  }

  await pool.execute(`
    UPDATE credit_invoices
    SET invoice_status = 'OVERDUE'
    WHERE outstanding_amount > 0
      AND due_date IS NOT NULL
      AND due_date < CURDATE()
      AND invoice_status IN ('UNPAID', 'PARTIAL')
  `);

  const conditions: string[] = [];
  const values: Array<string | number> = [];
  if (customerId !== null) {
    conditions.push("ci.customer_id = ?");
    values.push(customerId);
  }
  if (status === "open") conditions.push("ci.invoice_status IN ('UNPAID', 'PARTIAL', 'OVERDUE')");
  if (status === "paid") conditions.push("ci.invoice_status = 'PAID'");
  if (status === "overdue") conditions.push("ci.invoice_status = 'OVERDUE'");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [items] = await pool.query<CreditInvoiceRow[]>(`
    SELECT
      ci.credit_invoice_id AS id,
      ci.sale_id AS saleId,
      s.sale_no AS saleNumber,
      ci.invoice_no AS invoiceNumber,
      ci.customer_id AS customerId,
      c.full_name AS customerName,
      ci.original_amount AS originalAmount,
      ci.outstanding_amount AS outstandingAmount,
      ci.invoice_status AS status,
      DATE_FORMAT(ci.due_date, '%Y-%m-%d') AS dueDate,
      s.sold_at AS createdAt,
      (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = ci.sale_id) AS itemCount
    FROM credit_invoices ci
    INNER JOIN sales s ON s.sale_id = ci.sale_id
    INNER JOIN customers c ON c.customer_id = ci.customer_id
    ${where}
    ORDER BY ci.due_date IS NULL ASC, ci.due_date ASC, ci.credit_invoice_id ASC
  `, values);

  const summary = items.reduce((result, item) => {
    result.originalAmount += Number(item.originalAmount);
    result.outstandingAmount += Number(item.outstandingAmount);
    if (item.status === "OVERDUE") result.overdueAmount += Number(item.outstandingAmount);
    return result;
  }, { invoiceCount: items.length, originalAmount: 0, outstandingAmount: 0, overdueAmount: 0 });

  response.json({ success: true, data: { items, summary } });
}));

creditInvoicesRouter.get("/:id", asyncHandler(async (request, response) => {
  const invoiceId = positiveId(request.params.id, "รหัสใบหนี้");

  await pool.execute(`
    UPDATE credit_invoices
    SET invoice_status = 'OVERDUE'
    WHERE credit_invoice_id = ?
      AND outstanding_amount > 0
      AND due_date IS NOT NULL
      AND due_date < CURDATE()
      AND invoice_status IN ('UNPAID', 'PARTIAL')
  `, [invoiceId]);

  const [invoices] = await pool.query<CreditInvoiceDetailRow[]>(`
    SELECT
      ci.credit_invoice_id AS id,
      ci.sale_id AS saleId,
      s.sale_no AS saleNumber,
      ci.invoice_no AS invoiceNumber,
      ci.customer_id AS customerId,
      c.full_name AS customerName,
      ci.original_amount AS originalAmount,
      ci.outstanding_amount AS outstandingAmount,
      ci.invoice_status AS status,
      DATE_FORMAT(ci.due_date, '%Y-%m-%d') AS dueDate,
      s.sold_at AS createdAt,
      s.subtotal,
      s.discount_amount AS discountAmount,
      u.full_name AS cashierName,
      (SELECT COUNT(*) FROM sale_items counted_item WHERE counted_item.sale_id = ci.sale_id) AS itemCount
    FROM credit_invoices ci
    INNER JOIN sales s ON s.sale_id = ci.sale_id
    INNER JOIN customers c ON c.customer_id = ci.customer_id
    INNER JOIN users u ON u.user_id = s.cashier_id
    WHERE ci.credit_invoice_id = ?
    LIMIT 1
  `, [invoiceId]);
  const invoice = invoices[0];
  if (!invoice) throw new ApiError(404, "ไม่พบใบหนี้");

  const [items] = await pool.query<CreditInvoiceItemRow[]>(`
    SELECT
      si.sale_item_id AS id,
      p.product_id AS productId,
      p.product_name AS productName,
      pu.unit_name AS unitName,
      si.quantity,
      si.unit_price AS unitPrice,
      si.discount_amount AS discountAmount,
      si.line_total AS lineTotal
    FROM sale_items si
    INNER JOIN product_units pu ON pu.product_unit_id = si.product_unit_id
    INNER JOIN products p ON p.product_id = pu.product_id
    WHERE si.sale_id = ?
    ORDER BY si.sale_item_id ASC
  `, [invoice.saleId]);

  const [payments] = await pool.query<CreditInvoicePaymentRow[]>(`
    SELECT
      cp.credit_payment_id AS id,
      cp.paid_amount AS paidAmount,
      cp.payment_method AS paymentMethod,
      cp.reference_no AS referenceNumber,
      cp.paid_at AS paidAt,
      u.full_name AS receivedByName
    FROM credit_payments cp
    INNER JOIN users u ON u.user_id = cp.received_by
    WHERE cp.credit_invoice_id = ?
    ORDER BY cp.paid_at DESC, cp.credit_payment_id DESC
  `, [invoiceId]);

  response.json({
    success: true,
    data: {
      ...invoice,
      paidAmount: Number(invoice.originalAmount) - Number(invoice.outstandingAmount),
      items,
      payments,
    },
  });
}));

creditInvoicesRouter.post("/:id/payments", requireRoles("owner", "cashier"), asyncHandler(async (request, response) => {
  const invoiceId = positiveId(request.params.id, "รหัสใบหนี้");
  const body = request.body as { amount?: unknown; paymentMethod?: unknown; referenceNumber?: unknown };
  const amount = paymentAmount(body.amount);
  const method = paymentMethod(body.paymentMethod);
  const referenceNumber = optionalReference(body.referenceNumber);
  const receivedBy = authenticatedUserId(response);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [invoices] = await connection.query<CreditInvoiceForPayment[]>(`
      SELECT
        credit_invoice_id AS id,
        invoice_no AS invoiceNumber,
        customer_id AS customerId,
        outstanding_amount AS outstandingAmount,
        due_date AS dueDate,
        invoice_status AS status
      FROM credit_invoices
      WHERE credit_invoice_id = ?
      LIMIT 1
      FOR UPDATE
    `, [invoiceId]);
    const invoice = invoices[0];
    if (!invoice) throw new ApiError(404, "ไม่พบใบหนี้");

    const outstandingAmount = Number(invoice.outstandingAmount);
    if (invoice.status === "PAID" || outstandingAmount <= 0) {
      throw new ApiError(409, "ใบหนี้นี้ชำระครบแล้ว");
    }
    if (amount > outstandingAmount) {
      throw new ApiError(409, "ยอดรับชำระมากกว่ายอดค้าง", { outstandingAmount, requestedAmount: amount });
    }

    const databaseMethod = paymentMethods[method];
    const [payment] = await connection.execute<ResultSetHeader>(`
      INSERT INTO credit_payments (
        credit_invoice_id, received_by, paid_amount, payment_method, reference_no
      )
      VALUES (?, ?, ?, ?, ?)
    `, [invoiceId, receivedBy, amount, databaseMethod, referenceNumber]);

    const nextOutstandingAmount = Number((outstandingAmount - amount).toFixed(2));
    await connection.execute(`
      UPDATE credit_invoices
      SET outstanding_amount = ?,
          invoice_status = CASE
            WHEN ? = 0 THEN 'PAID'
            WHEN due_date IS NOT NULL AND due_date < CURDATE() THEN 'OVERDUE'
            ELSE 'PARTIAL'
          END
      WHERE credit_invoice_id = ?
    `, [nextOutstandingAmount, nextOutstandingAmount, invoiceId]);
    const [updatedInvoices] = await connection.query<Array<RowDataPacket & { status: CreditInvoiceStatus }>>(`
      SELECT invoice_status AS status
      FROM credit_invoices
      WHERE credit_invoice_id = ?
      LIMIT 1
    `, [invoiceId]);
    const nextStatus = updatedInvoices[0]?.status ?? (nextOutstandingAmount === 0 ? "PAID" : "PARTIAL");

    const categoryId = await incomeCategoryId(connection);
    await connection.execute(`
      INSERT INTO cash_transactions (
        cash_category_id, recorded_by, credit_payment_id, transaction_type,
        transaction_date, amount, payment_method, description, reference_no
      )
      VALUES (?, ?, ?, 'INCOME', CURDATE(), ?, ?, ?, ?)
    `, [
      categoryId,
      receivedBy,
      payment.insertId,
      amount,
      databaseMethod,
      `รับชำระหนี้ ${invoice.invoiceNumber}`,
      referenceNumber ?? invoice.invoiceNumber,
    ]);

    await connection.commit();
    response.status(201).json({
      success: true,
      data: {
        id: payment.insertId,
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        paidAmount: amount,
        outstandingAmount: nextOutstandingAmount,
        status: nextStatus,
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));
