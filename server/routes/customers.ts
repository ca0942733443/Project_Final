import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";

interface CustomerRow extends RowDataPacket {
  id: number;
  customerCode: string;
  fullName: string;
  phone: string | null;
  creditLimit: number;
  balanceDue: number;
  orderCount: number;
  totalSpent: number;
  favoriteProduct: string | null;
  lastPurchaseAt: Date | null;
}

interface CustomerStatsRow extends RowDataPacket {
  totalCustomers: number;
  activeCustomers: number;
  customersWithDebt: number;
  totalBalanceDue: number;
  creditSalesThisMonth: number;
}

type CustomerInput = {
  customerCode?: unknown;
  fullName?: unknown;
  phone?: unknown;
  creditLimit?: unknown;
  balanceDue?: unknown;
  locationId?: unknown;
  carTypeId?: unknown;
};

export const customersRouter = Router();

function requiredText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, `กรุณาระบุ ${fieldName}`);
  }
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nonNegativeNumber(value: unknown, fieldName: string, fallback?: number) {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new ApiError(400, `${fieldName} ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`);
  }
  return numberValue;
}

function positiveId(value: unknown, fieldName: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, `${fieldName} ไม่ถูกต้อง`);
  return id;
}

async function defaultLocationId(connection: PoolConnection) {
  const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(`
    SELECT location_id AS id FROM location ORDER BY location_id ASC LIMIT 1 FOR UPDATE
  `);
  if (rows[0]) return rows[0].id;
  await connection.execute("INSERT INTO location (location_id, location_name) VALUES (1, ?)", ["ไม่ระบุ"]);
  return 1;
}

async function defaultCarTypeId(connection: PoolConnection) {
  const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(`
    SELECT car_type_id AS id FROM car_type ORDER BY car_type_id ASC LIMIT 1 FOR UPDATE
  `);
  if (rows[0]) return rows[0].id;
  await connection.execute("INSERT INTO car_type (car_type_id, ca_rtype_name) VALUES (1, ?)", ["ไม่ระบุ"]);
  return 1;
}

customersRouter.get("/stats", asyncHandler(async (_request, response) => {
  const [rows] = await pool.query<CustomerStatsRow[]>(`
    SELECT
      COUNT(*) AS totalCustomers,
      COALESCE(SUM(c.is_active = 1), 0) AS activeCustomers,
      COALESCE(SUM(c.is_active = 1 AND COALESCE(d.balance_due, 0) > 0), 0) AS customersWithDebt,
      COALESCE(SUM(CASE WHEN c.is_active = 1 THEN COALESCE(d.balance_due, 0) ELSE 0 END), 0) AS totalBalanceDue,
      COALESCE((
        SELECT SUM(ci.original_amount)
        FROM credit_invoices ci
        INNER JOIN sales s ON s.sale_id = ci.sale_id
        WHERE s.sale_status = 'CREDIT'
          AND s.sold_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
      ), 0) AS creditSalesThisMonth
    FROM customers c
    LEFT JOIN (
      SELECT customer_id, SUM(outstanding_amount) AS balance_due
      FROM credit_invoices
      WHERE invoice_status IN ('UNPAID', 'PARTIAL', 'OVERDUE')
      GROUP BY customer_id
    ) d ON d.customer_id = c.customer_id
  `);

  response.json({ success: true, data: rows[0] });
}));

customersRouter.get("/", asyncHandler(async (request, response) => {
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const values: string[] = [];
  const searchCondition = search
    ? "AND (c.full_name LIKE ? OR CONCAT('CUS-', LPAD(c.customer_id, 4, '0')) LIKE ? OR c.phone LIKE ?)"
    : "";
  if (search) values.push(`%${search}%`, `%${search}%`, `%${search}%`);

  const [customers] = await pool.query<CustomerRow[]>(`
    SELECT
      c.customer_id AS id,
      CONCAT('CUS-', LPAD(c.customer_id, 4, '0')) AS customerCode,
      c.full_name AS fullName,
      c.phone,
      c.credit_limit AS creditLimit,
      COALESCE(d.balanceDue, 0) AS balanceDue,
      COALESCE(s.orderCount, 0) AS orderCount,
      COALESCE(s.totalSpent, 0) AS totalSpent,
      s.lastPurchaseAt,
      (
        SELECT p.product_name
        FROM sales favorite_sale
        INNER JOIN sale_items favorite_item ON favorite_item.sale_id = favorite_sale.sale_id
        INNER JOIN product_units pu ON pu.product_unit_id = favorite_item.product_unit_id
        INNER JOIN products p ON p.product_id = pu.product_id
        WHERE favorite_sale.customer_id = c.customer_id
          AND favorite_sale.sale_status <> 'CANCELLED'
        GROUP BY p.product_id, p.product_name
        ORDER BY SUM(favorite_item.quantity_base) DESC
        LIMIT 1
      ) AS favoriteProduct
    FROM customers c
    LEFT JOIN (
      SELECT
        customer_id,
        COUNT(*) AS orderCount,
        SUM(total_amount) AS totalSpent,
        MAX(sold_at) AS lastPurchaseAt
      FROM sales
      WHERE sale_status <> 'CANCELLED'
      GROUP BY customer_id
    ) s ON s.customer_id = c.customer_id
    LEFT JOIN (
      SELECT customer_id, SUM(outstanding_amount) AS balanceDue
      FROM credit_invoices
      WHERE invoice_status IN ('UNPAID', 'PARTIAL', 'OVERDUE')
      GROUP BY customer_id
    ) d ON d.customer_id = c.customer_id
    WHERE c.is_active = 1 ${searchCondition}
    ORDER BY c.full_name ASC
  `, values);

  response.json({ success: true, data: customers });
}));

customersRouter.post("/", asyncHandler(async (request, response) => {
  const body = request.body as CustomerInput;
  const fullName = requiredText(body.fullName, "ชื่อลูกค้า");
  const phone = optionalText(body.phone);
  const creditLimit = nonNegativeNumber(body.creditLimit, "วงเงินเครดิต", 0);
  const balanceDue = nonNegativeNumber(body.balanceDue, "ยอดค้างชำระ", 0);
  if (balanceDue > 0) {
    throw new ApiError(400, "ยอดค้างชำระต้องเกิดจากใบแจ้งหนี้ขายเชื่อ ไม่สามารถกำหนดตอนสร้างลูกค้าได้");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const locationId = body.locationId === undefined
      ? await defaultLocationId(connection)
      : positiveId(body.locationId, "รหัสสถานที่");
    const carTypeId = body.carTypeId === undefined
      ? await defaultCarTypeId(connection)
      : positiveId(body.carTypeId, "รหัสประเภทรถ");
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO customers (
        full_name, phone, credit_limit, is_active,
        location_location_id, car_type_car_type_id
      )
      VALUES (?, ?, ?, 1, ?, ?)
    `, [fullName, phone, creditLimit, locationId, carTypeId]);
    await connection.commit();
    response.status(201).json({
      success: true,
      data: { id: result.insertId, customerCode: `CUS-${String(result.insertId).padStart(4, "0")}` },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

customersRouter.patch("/:id", asyncHandler(async (request, response) => {
  const customerId = positiveId(request.params.id, "รหัสลูกค้า");
  const body = request.body as CustomerInput;
  const updates: string[] = [];
  const values: Array<string | number | null> = [];
  const setValue = (column: string, value: string | number | null) => {
    updates.push(`${column} = ?`);
    values.push(value);
  };

  if (body.fullName !== undefined) setValue("full_name", requiredText(body.fullName, "ชื่อลูกค้า"));
  if (body.phone !== undefined) setValue("phone", optionalText(body.phone));
  if (body.creditLimit !== undefined) setValue("credit_limit", nonNegativeNumber(body.creditLimit, "วงเงินเครดิต"));
  if (body.locationId !== undefined) setValue("location_location_id", positiveId(body.locationId, "รหัสสถานที่"));
  if (body.carTypeId !== undefined) setValue("car_type_car_type_id", positiveId(body.carTypeId, "รหัสประเภทรถ"));
  if (body.balanceDue !== undefined) {
    throw new ApiError(400, "ยอดค้างชำระต้องแก้ผ่านรายการชำระใบแจ้งหนี้");
  }
  if (updates.length === 0) throw new ApiError(400, "ไม่มีข้อมูลสำหรับแก้ไข");

  values.push(customerId);
  const [result] = await pool.execute<ResultSetHeader>(`
    UPDATE customers SET ${updates.join(", ")}
    WHERE customer_id = ? AND is_active = 1
  `, values);
  if (result.affectedRows === 0) throw new ApiError(404, "ไม่พบลูกค้า");
  response.json({ success: true });
}));

customersRouter.delete("/:id", asyncHandler(async (request, response) => {
  const customerId = positiveId(request.params.id, "รหัสลูกค้า");
  const [result] = await pool.execute<ResultSetHeader>(`
    UPDATE customers SET is_active = 0
    WHERE customer_id = ? AND is_active = 1
  `, [customerId]);
  if (result.affectedRows === 0) throw new ApiError(404, "ไม่พบลูกค้า");
  response.status(204).send();
}));
