import "dotenv/config";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { app } from "../app";
import { env } from "../config/env";
import { pool } from "../db/pool";
import { createAuthToken } from "../utils/auth-token";

const seedPrefix = "DEMO-REC-";
const customerPhonePrefix = "090-REC-";

interface UserRow extends RowDataPacket {
  id: number;
}

interface ProductRow extends RowDataPacket {
  id: number;
  name: string;
  productUnitId: number;
  unit: string;
  conversionFactor: number;
  price: number;
}

interface SeedCustomerRow {
  id: number;
  name: string;
  phone: string;
}

interface RecommendationResponse {
  customers: Array<{
    customerId: number;
    daysSinceLastPurchase: number;
    products: Array<{ productId: number; productName: string }>;
  }>;
}

function sqlDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function removePreviousSeed(connection: mysql.Connection) {
  const [sales] = await connection.query<Array<RowDataPacket & { id: number }>>(
    "SELECT sale_id AS id FROM sales WHERE sale_no LIKE ?",
    [`${seedPrefix}%`],
  );
  const saleIds = sales.map((sale) => sale.id);

  if (saleIds.length > 0) {
    await connection.query(`
      DELETE cash_transaction
      FROM cash_transactions cash_transaction
      INNER JOIN sale_payments sale_payment ON sale_payment.sale_payment_id = cash_transaction.sale_payment_id
      WHERE sale_payment.sale_id IN (?)
    `, [saleIds]);
    await connection.query("DELETE FROM credit_invoices WHERE sale_id IN (?)", [saleIds]);
    await connection.query("DELETE FROM sale_payments WHERE sale_id IN (?)", [saleIds]);
    await connection.query("DELETE FROM sale_items WHERE sale_id IN (?)", [saleIds]);
    await connection.query("DELETE FROM sales WHERE sale_id IN (?)", [saleIds]);
  }

  await connection.query(`
    DELETE customer
    FROM customers customer
    LEFT JOIN sales sale ON sale.customer_id = customer.customer_id
    WHERE customer.phone LIKE ? AND sale.sale_id IS NULL
  `, [`${customerPhonePrefix}%`]);
}

async function requestRecommendations(port: number, userId: number) {
  const token = createAuthToken(userId, "owner");
  const response = await fetch(`http://127.0.0.1:${port}/api/recommendations?inactivityDays=3`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json() as { success: boolean; data?: RecommendationResponse; error?: string };
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? `Recommendations API failed with ${response.status}`);
  }
  return payload.data;
}

async function seed() {
  const connection = await mysql.createConnection({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database: env.database.name,
    decimalNumbers: true,
    charset: "utf8mb4",
  });
  let apiServer: ReturnType<typeof app.listen> | undefined;

  try {
    await connection.beginTransaction();
    await removePreviousSeed(connection);

    const [users] = await connection.query<UserRow[]>(`
      SELECT user_id AS id
      FROM users
      WHERE status = 'ACTIVE'
      ORDER BY user_id ASC
      LIMIT 1
    `);
    const cashierId = users[0]?.id;
    if (!cashierId) throw new Error("ไม่พบผู้ใช้งานที่ active สำหรับสร้างข้อมูลทดสอบ");

    const [products] = await connection.query<ProductRow[]>(`
      SELECT
        p.product_id AS id,
        p.product_name AS name,
        pu.product_unit_id AS productUnitId,
        pu.unit_name AS unit,
        pu.conversion_factor AS conversionFactor,
        pu.selling_price AS price
      FROM products p
      INNER JOIN product_units pu ON pu.product_unit_id = (
        SELECT pu2.product_unit_id
        FROM product_units pu2
        WHERE pu2.product_id = p.product_id AND pu2.is_active = 1
        ORDER BY pu2.is_default DESC, pu2.product_unit_id ASC
        LIMIT 1
      )
      WHERE p.is_active = 1
      ORDER BY p.product_id ASC
      LIMIT 3
    `);
    if (products.length < 3) throw new Error("ต้องมีสินค้า active อย่างน้อย 3 รายการสำหรับ seed");

    const customerInputs = [
      { name: "ลูกค้าทดสอบระบบแนะนำ 1", phone: `${customerPhonePrefix}001`, plate: "REC-0001" },
      { name: "ลูกค้าทดสอบระบบแนะนำ 2", phone: `${customerPhonePrefix}002`, plate: "REC-0002" },
      { name: "ลูกค้าทดสอบระบบแนะนำ 3", phone: `${customerPhonePrefix}003`, plate: "REC-0003" },
    ];
    const customers: SeedCustomerRow[] = [];

    for (const customer of customerInputs) {
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO customers (full_name, phone, car_plate, credit_limit, is_active, location)
        VALUES (?, ?, ?, 100000, 1, ?)
      `, [customer.name, customer.phone, customer.plate, "DEMO"]);
      customers.push({ id: result.insertId, name: customer.name, phone: customer.phone });
    }

    await connection.execute(`
      INSERT INTO cash_categories (category_name, transaction_type, is_active)
      VALUES ('รายได้จากการขาย', 'INCOME', 1)
      ON DUPLICATE KEY UPDATE is_active = 1
    `);
    const [cashCategories] = await connection.query<Array<RowDataPacket & { id: number }>>(`
      SELECT cash_category_id AS id
      FROM cash_categories
      WHERE category_name = 'รายได้จากการขาย' AND transaction_type = 'INCOME'
      LIMIT 1
    `);
    const incomeCategoryId = cashCategories[0]?.id;
    if (!incomeCategoryId) throw new Error("ไม่พบหมวดรายได้จากการขาย");

    const saleInputs = [
      { customerIndex: 0, productIndex: 0, daysAgo: 4, quantity: 4 },
      { customerIndex: 0, productIndex: 1, daysAgo: 6, quantity: 2 },
      { customerIndex: 1, productIndex: 1, daysAgo: 7, quantity: 3 },
      { customerIndex: 1, productIndex: 2, daysAgo: 8, quantity: 1 },
      { customerIndex: 2, productIndex: 2, daysAgo: 12, quantity: 2 },
      { customerIndex: 2, productIndex: 0, daysAgo: 13, quantity: 1 },
    ];

    for (const [index, saleInput] of saleInputs.entries()) {
      const product = products[saleInput.productIndex];
      const customer = customers[saleInput.customerIndex];
      const soldAt = new Date(Date.now() - saleInput.daysAgo * 24 * 60 * 60 * 1000);
      const total = Number((Number(product.price) * saleInput.quantity).toFixed(2));
      const saleNo = `${seedPrefix}${String(index + 1).padStart(3, "0")}`;
      const quantityBase = Number((saleInput.quantity * Number(product.conversionFactor)).toFixed(3));

      const [sale] = await connection.execute<ResultSetHeader>(`
        INSERT INTO sales (
          customer_id, cashier_id, sale_no, sold_at,
          subtotal, discount_amount, total_amount, sale_status
        )
        VALUES (?, ?, ?, ?, ?, 0, ?, 'COMPLETED')
      `, [customer.id, cashierId, saleNo, soldAt, total, total]);
      await connection.execute(`
        INSERT INTO sale_items (
          sale_id, product_unit_id, quantity, quantity_base,
          unit_price, discount_amount, line_total
        )
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `, [sale.insertId, product.productUnitId, saleInput.quantity, quantityBase, product.price, total]);
      const [payment] = await connection.execute<ResultSetHeader>(`
        INSERT INTO sale_payments (
          sale_id, payment_method, paid_amount, change_amount, paid_at, reference_no
        )
        VALUES (?, 'CASH', ?, 0, ?, ?)
      `, [sale.insertId, total, soldAt, saleNo]);
      await connection.execute(`
        INSERT INTO cash_transactions (
          cash_category_id, recorded_by, sale_payment_id, transaction_type,
          transaction_date, transaction_time, amount, payment_method,
          description, reference_no
        )
        VALUES (?, ?, ?, 'INCOME', ?, ?, ?, 'CASH', ?, ?)
      `, [incomeCategoryId, cashierId, payment.insertId, sqlDate(soldAt), soldAt, total, `รายการขาย ${saleNo}`, saleNo]);
    }

    await connection.commit();

    apiServer = app.listen(0, "127.0.0.1");
    await once(apiServer, "listening");
    const address = apiServer.address() as AddressInfo;
    const recommendationData = await requestRecommendations(address.port, cashierId);
    const seededCustomerIds = new Set(customers.map((customer) => customer.id));
    const matchedCustomers = recommendationData.customers.filter((customer) => seededCustomerIds.has(customer.customerId));
    if (matchedCustomers.length !== customers.length) {
      throw new Error(`พบลูกค้าทดสอบในคำแนะนำ ${matchedCustomers.length}/${customers.length} ราย`);
    }
    if (matchedCustomers.some((customer) => customer.daysSinceLastPurchase < 3 || customer.products.length === 0)) {
      throw new Error("ข้อมูลลูกค้าทดสอบไม่ผ่านเงื่อนไขวันที่หายไปหรือไม่มีสินค้าแนะนำ");
    }

    console.log(JSON.stringify({
      success: true,
      message: "Seed ข้อมูลลูกค้าสำหรับระบบแนะนำสำเร็จ และ API ตรวจสอบผ่าน",
      customers: customers.map((customer) => ({ id: customer.id, name: customer.name, phone: customer.phone })),
      products: products.map((product) => ({ id: product.id, name: product.name })),
      inactivityDays: 3,
      verifiedCustomers: matchedCustomers.length,
      note: "ข้อมูลนี้ถูกเก็บไว้ในฐานข้อมูลเพื่อเปิดดูจากหน้าแนะนำได้",
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (apiServer) {
      apiServer.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        apiServer?.close((closeError) => closeError ? reject(closeError) : resolve());
      });
    }
    await connection.end();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
