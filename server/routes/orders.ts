import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../db/pool";
import { deductStock } from "../db/stock";
import { ApiError } from "../utils/api-error";
import { authenticatedUserId } from "../utils/auth-context";
import { asyncHandler } from "../utils/async-handler";

type PaymentMethod = "cash" | "qr" | "credit";

interface ProductForOrder extends RowDataPacket {
  id: number;
  name: string;
  productUnitId: number;
  price: number;
  conversionFactor: number;
  stockQuantityBase: number;
}

interface OrderRow extends RowDataPacket {
  id: number;
  orderNumber: string;
  subtotal: number;
  total: number;
  status: "paid" | "cancelled";
  isCredit: number;
  createdAt: Date;
}

interface OrderListRow extends RowDataPacket {
  id: number;
  orderNumber: string;
  subtotal: number;
  total: number;
  status: "paid" | "cancelled";
  createdAt: Date;
  customerName: string | null;
  employeeName: string | null;
  paymentMethod: PaymentMethod | null;
}

interface OrderSummaryRow extends RowDataPacket {
  totalSales: number;
  orderCount: number;
}

interface OrderItemRow extends RowDataPacket {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface PaymentRow extends RowDataPacket {
  method: PaymentMethod;
  amountReceived: number;
  amountPaid: number;
  changeAmount: number;
  paidAt: Date;
}

export const ordersRouter = Router();

function createOrderNumber() {
  const date = new Date();
  const stamp = [
    date.getFullYear().toString().slice(-2),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  return `SALE-${stamp}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

async function incomeCategoryId(connection: PoolConnection) {
  const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(`
    SELECT cash_category_id AS id
    FROM cash_categories
    WHERE category_name = ? AND transaction_type = 'INCOME'
    ORDER BY cash_category_id ASC
    LIMIT 1
    FOR UPDATE
  `, ["รายได้จากการขาย"]);
  if (rows[0]) return rows[0].id;
  const [result] = await connection.execute<ResultSetHeader>(`
    INSERT INTO cash_categories (category_name, transaction_type, is_active)
    VALUES (?, 'INCOME', 1)
  `, ["รายได้จากการขาย"]);
  return result.insertId;
}

ordersRouter.get("/", asyncHandler(async (request, response) => {
  const dateFrom = typeof request.query.dateFrom === "string" ? request.query.dateFrom : "";
  const dateTo = typeof request.query.dateTo === "string" ? request.query.dateTo : "";
  const paymentMethod = typeof request.query.paymentMethod === "string" ? request.query.paymentMethod : "";
  const status = typeof request.query.status === "string" ? request.query.status : "";
  const requestedLimit = Number(request.query.limit ?? 100);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (dateFrom) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) throw new ApiError(400, "วันที่เริ่มต้นไม่ถูกต้อง");
    conditions.push("s.sold_at >= ?");
    values.push(dateFrom);
  }
  if (dateTo) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) throw new ApiError(400, "วันที่สิ้นสุดไม่ถูกต้อง");
    conditions.push("s.sold_at < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(dateTo);
  }
  if (paymentMethod) {
    if (!("cash qr credit".split(" ")).includes(paymentMethod)) {
      throw new ApiError(400, "ช่องทางชำระเงินไม่ถูกต้อง");
    }
    conditions.push(paymentMethod === "credit"
      ? "s.sale_status = 'CREDIT'"
      : paymentMethod === "cash"
        ? "EXISTS (SELECT 1 FROM sale_payments filter_payment WHERE filter_payment.sale_id = s.sale_id AND filter_payment.payment_method = 'CASH')"
        : "EXISTS (SELECT 1 FROM sale_payments filter_payment WHERE filter_payment.sale_id = s.sale_id AND filter_payment.payment_method IN ('QR_CODE', 'BANK_TRANSFER'))");
  }
  if (status) {
    if (!["paid", "cancelled"].includes(status)) throw new ApiError(400, "สถานะรายการขายไม่ถูกต้อง");
    conditions.push(status === "cancelled" ? "s.sale_status = 'CANCELLED'" : "s.sale_status <> 'CANCELLED'");
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [orders] = await pool.query<OrderListRow[]>(`
    SELECT
      s.sale_id AS id,
      s.sale_no AS orderNumber,
      s.subtotal,
      s.total_amount AS total,
      CASE WHEN s.sale_status = 'CANCELLED' THEN 'cancelled' ELSE 'paid' END AS status,
      s.sold_at AS createdAt,
      c.full_name AS customerName,
      u.full_name AS employeeName,
      CASE
        WHEN s.sale_status = 'CREDIT' THEN 'credit'
        ELSE (
          SELECT CASE sp.payment_method WHEN 'CASH' THEN 'cash' ELSE 'qr' END
          FROM sale_payments sp
          WHERE sp.sale_id = s.sale_id
          ORDER BY sp.sale_payment_id DESC
          LIMIT 1
        )
      END AS paymentMethod
    FROM sales s
    LEFT JOIN customers c ON c.customer_id = s.customer_id
    INNER JOIN users u ON u.user_id = s.cashier_id
    ${where}
    ORDER BY s.sold_at DESC, s.sale_id DESC
    LIMIT ?
  `, [...values, limit]);
  const [summaryRows] = await pool.query<OrderSummaryRow[]>(`
    SELECT
      COALESCE(SUM(CASE WHEN s.sale_status <> 'CANCELLED' THEN s.total_amount ELSE 0 END), 0) AS totalSales,
      COALESCE(SUM(s.sale_status <> 'CANCELLED'), 0) AS orderCount
    FROM sales s
    ${where}
  `, values);

  response.json({ success: true, data: { items: orders, summary: summaryRows[0] } });
}));

ordersRouter.post("/", asyncHandler(async (request, response) => {
  const body = request.body as {
    customerId?: unknown;
    employeeId?: unknown;
    paymentMethod?: unknown;
    amountReceived?: unknown;
    transactionReference?: unknown;
    items?: Array<{ productId?: unknown; quantity?: unknown }>;
  };

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new ApiError(400, "กรุณาระบุสินค้าอย่างน้อย 1 รายการ");
  }
  if (!("cash qr credit".split(" ") as unknown[]).includes(body.paymentMethod)) {
    throw new ApiError(400, "ช่องทางชำระเงินไม่ถูกต้อง");
  }
  const paymentMethod = body.paymentMethod as PaymentMethod;

  const quantities = new Map<number, number>();
  for (const item of body.items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, "รายการสินค้ามีรหัสหรือจำนวนไม่ถูกต้อง");
    }
    quantities.set(productId, Number(((quantities.get(productId) ?? 0) + quantity).toFixed(3)));
  }

  const productIds = [...quantities.keys()];
  const placeholders = productIds.map(() => "?").join(",");
  const cashierId = authenticatedUserId(response);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [cashiers] = await connection.query<Array<RowDataPacket & { id: number }>>(`
      SELECT user_id AS id FROM users
      WHERE user_id = ? AND status = 'ACTIVE'
      LIMIT 1 FOR UPDATE
    `, [cashierId]);
    if (!cashiers[0]) throw new ApiError(401, "บัญชีผู้ขายไม่พร้อมใช้งาน");

    const [products] = await connection.query<ProductForOrder[]>(`
      SELECT
        p.product_id AS id,
        p.product_name AS name,
        pu.product_unit_id AS productUnitId,
        pu.selling_price AS price,
        pu.conversion_factor AS conversionFactor,
        COALESCE(stock.stockQuantityBase, 0) AS stockQuantityBase
      FROM products p
      INNER JOIN product_units pu ON pu.product_unit_id = (
        SELECT pu2.product_unit_id
        FROM product_units pu2
        WHERE pu2.product_id = p.product_id AND pu2.is_active = 1
        ORDER BY pu2.is_default DESC, pu2.product_unit_id ASC
        LIMIT 1
      )
      LEFT JOIN (
        SELECT product_id, SUM(quantity_remaining_base) AS stockQuantityBase
        FROM product_batches
        WHERE status IN ('ACTIVE', 'NEAR_EXPIRY')
        GROUP BY product_id
      ) stock ON stock.product_id = p.product_id
      WHERE p.product_id IN (${placeholders}) AND p.is_active = 1
      FOR UPDATE
    `, productIds);
    if (products.length !== productIds.length) {
      throw new ApiError(400, "มีสินค้าบางรายการไม่พบ ไม่มีหน่วยขาย หรือถูกปิดใช้งาน");
    }

    let total = 0;
    for (const product of products) {
      const quantity = quantities.get(product.id) ?? 0;
      const quantityBase = Number((quantity * Number(product.conversionFactor)).toFixed(3));
      if (Number(product.stockQuantityBase) < quantityBase) {
        throw new ApiError(409, `สินค้า ${product.name} มีสต็อกไม่เพียงพอ`, {
          productId: product.id,
          available: product.stockQuantityBase,
          requested: quantityBase,
        });
      }
      total += Number(product.price) * quantity;
    }
    total = Number(total.toFixed(2));

    const amountReceived = paymentMethod === "cash"
      ? Number(body.amountReceived)
      : paymentMethod === "qr"
        ? total
        : 0;
    if (paymentMethod === "cash" && (!Number.isFinite(amountReceived) || amountReceived < total)) {
      throw new ApiError(400, "จำนวนเงินที่ได้รับไม่เพียงพอ");
    }
    const changeAmount = paymentMethod === "cash" ? Number((amountReceived - total).toFixed(2)) : 0;
    const customerId = body.customerId ? Number(body.customerId) : null;
    if (customerId !== null && (!Number.isInteger(customerId) || customerId <= 0)) {
      throw new ApiError(400, "รหัสลูกค้าไม่ถูกต้อง");
    }
    if (paymentMethod === "credit" && customerId === null) {
      throw new ApiError(400, "การขายเชื่อต้องระบุลูกค้า");
    }

    if (customerId !== null) {
      const [customers] = await connection.query<Array<RowDataPacket & { creditLimit: number }>>(`
        SELECT credit_limit AS creditLimit
        FROM customers
        WHERE customer_id = ? AND is_active = 1
        LIMIT 1 FOR UPDATE
      `, [customerId]);
      const customer = customers[0];
      if (!customer) throw new ApiError(404, "ไม่พบลูกค้า");
      if (paymentMethod === "credit") {
        const [debts] = await connection.query<Array<RowDataPacket & { balanceDue: number }>>(`
          SELECT COALESCE(SUM(outstanding_amount), 0) AS balanceDue
          FROM credit_invoices
          WHERE customer_id = ? AND invoice_status IN ('UNPAID', 'PARTIAL', 'OVERDUE')
        `, [customerId]);
        const balanceDue = Number(debts[0]?.balanceDue ?? 0);
        if (Number(customer.creditLimit) <= 0 || balanceDue + total > Number(customer.creditLimit)) {
          throw new ApiError(409, "วงเงินเครดิตของลูกค้าไม่เพียงพอ");
        }
      }
    }

    const orderNumber = createOrderNumber();
    const saleStatus = paymentMethod === "credit" ? "CREDIT" : "COMPLETED";
    const [saleResult] = await connection.execute<ResultSetHeader>(`
      INSERT INTO sales (
        customer_id, cashier_id, sale_no, subtotal, discount_amount, total_amount, sale_status
      )
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `, [customerId, cashierId, orderNumber, total, total, saleStatus]);

    for (const product of products) {
      const quantity = quantities.get(product.id) ?? 0;
      const quantityBase = Number((quantity * Number(product.conversionFactor)).toFixed(3));
      const lineTotal = Number((Number(product.price) * quantity).toFixed(2));
      const [itemResult] = await connection.execute<ResultSetHeader>(`
        INSERT INTO sale_items (
          sale_id, product_unit_id, quantity, quantity_base,
          unit_price, discount_amount, line_total
        )
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `, [saleResult.insertId, product.productUnitId, quantity, quantityBase, product.price, lineTotal]);
      await deductStock(connection, {
        productId: product.id,
        quantityBase,
        recordedBy: cashierId,
        reference: orderNumber,
        movementType: "OUT",
        saleItemId: itemResult.insertId,
      });
    }

    const transactionReference = typeof body.transactionReference === "string"
      ? body.transactionReference.trim().slice(0, 100) || null
      : null;
    if (paymentMethod === "credit" && customerId !== null) {
      await connection.execute(`
        INSERT INTO credit_invoices (
          sale_id, customer_id, invoice_no, original_amount,
          outstanding_amount, invoice_status
        )
        VALUES (?, ?, ?, ?, ?, 'UNPAID')
      `, [saleResult.insertId, customerId, `CR-${orderNumber}`, total, total]);
    } else {
      const databasePaymentMethod = paymentMethod === "cash" ? "CASH" : "QR_CODE";
      const [paymentResult] = await connection.execute<ResultSetHeader>(`
        INSERT INTO sale_payments (
          sale_id, payment_method, paid_amount, change_amount, reference_no
        )
        VALUES (?, ?, ?, ?, ?)
      `, [saleResult.insertId, databasePaymentMethod, total, changeAmount, transactionReference]);
      const categoryId = await incomeCategoryId(connection);
      await connection.execute(`
        INSERT INTO cash_transactions (
          cash_category_id, recorded_by, sale_payment_id, transaction_type,
          transaction_date, amount, payment_method, description, reference_no
        )
        VALUES (?, ?, ?, 'INCOME', CURDATE(), ?, ?, ?, ?)
      `, [
        categoryId,
        cashierId,
        paymentResult.insertId,
        total,
        databasePaymentMethod,
        `รายการขาย ${orderNumber}`,
        transactionReference ?? orderNumber,
      ]);
    }

    await connection.commit();
    response.status(201).json({
      success: true,
      data: {
        id: saleResult.insertId,
        orderNumber,
        total,
        amountReceived,
        changeAmount,
        paymentMethod,
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

ordersRouter.get("/:orderNumber", asyncHandler(async (request, response) => {
  const [orders] = await pool.query<OrderRow[]>(`
    SELECT
      sale_id AS id,
      sale_no AS orderNumber,
      subtotal,
      total_amount AS total,
      CASE WHEN sale_status = 'CANCELLED' THEN 'cancelled' ELSE 'paid' END AS status,
      (sale_status = 'CREDIT') AS isCredit,
      sold_at AS createdAt
    FROM sales
    WHERE sale_no = ?
    LIMIT 1
  `, [request.params.orderNumber]);
  const order = orders[0];
  if (!order) throw new ApiError(404, "ไม่พบรายการขาย");

  const [items] = await pool.query<OrderItemRow[]>(`
    SELECT
      p.product_id AS productId,
      p.product_name AS productName,
      si.quantity,
      si.unit_price AS unitPrice,
      si.line_total AS lineTotal
    FROM sale_items si
    INNER JOIN product_units pu ON pu.product_unit_id = si.product_unit_id
    INNER JOIN products p ON p.product_id = pu.product_id
    WHERE si.sale_id = ?
    ORDER BY si.sale_item_id ASC
  `, [order.id]);
  const [storedPayments] = await pool.query<PaymentRow[]>(`
    SELECT
      CASE payment_method WHEN 'CASH' THEN 'cash' ELSE 'qr' END AS method,
      (paid_amount + change_amount) AS amountReceived,
      paid_amount AS amountPaid,
      change_amount AS changeAmount,
      paid_at AS paidAt
    FROM sale_payments
    WHERE sale_id = ?
    ORDER BY sale_payment_id ASC
  `, [order.id]);
  const payments: PaymentRow[] = order.isCredit
    ? [{
      method: "credit",
      amountReceived: 0,
      amountPaid: 0,
      changeAmount: 0,
      paidAt: order.createdAt,
    } as PaymentRow]
    : storedPayments;
  const { isCredit: _isCredit, ...orderResponse } = order;
  response.json({ success: true, data: { ...orderResponse, items, payments } });
}));
