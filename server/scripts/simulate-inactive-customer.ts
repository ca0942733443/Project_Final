import "dotenv/config";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { app } from "../app";
import { env } from "../config/env";
import { pool } from "../db/pool";
import { createAuthToken } from "../utils/auth-token";

interface UserRow extends RowDataPacket {
  id: number;
}

interface CustomerRow extends RowDataPacket {
  id: number;
  name: string;
}

interface ProductRow extends RowDataPacket {
  id: number;
  name: string;
  price: number;
  stockQuantityBase: number;
  conversionFactor: number;
}

interface OrderResponse {
  orderNumber: string;
  total: number;
  amountReceived: number;
  changeAmount: number;
  paymentMethod: "cash" | "qr";
}

interface RecommendationResponse {
  customers: Array<{
    customerId: number;
    daysSinceLastPurchase: number;
    products: Array<{ productId: number; productName: string }>;
  }>;
}

async function api<T>(baseUrl: string, token: string, path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  const payload = text ? JSON.parse(text) as { success: boolean; data?: T; error?: string } : null;
  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(payload?.error ?? `${init?.method ?? "GET"} ${path} failed with ${response.status}`);
  }
  return payload.data;
}

async function run() {
  const connection = await mysql.createConnection({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database: env.database.name,
    decimalNumbers: true,
    charset: "utf8mb4",
  });
  let server: ReturnType<typeof app.listen> | undefined;

  try {
    const [users] = await connection.query<UserRow[]>(`
      SELECT user_id AS id
      FROM users
      WHERE status = 'ACTIVE'
      ORDER BY user_id ASC
      LIMIT 1
    `);
    const userId = users[0]?.id;
    if (!userId) throw new Error("ไม่พบผู้ใช้งานที่ active");

    const [customers] = await connection.query<CustomerRow[]>(`
      SELECT customer_id AS id, full_name AS name
      FROM customers
      WHERE phone = '090-REC-001' AND is_active = 1
      LIMIT 1
    `);
    const customer = customers[0];
    if (!customer) throw new Error("ไม่พบลูกค้า Demo 090-REC-001 กรุณารัน npm run db:seed:recommendations ก่อน");

    const [products] = await connection.query<ProductRow[]>(`
      SELECT
        p.product_id AS id,
        p.product_name AS name,
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
      WHERE p.is_active = 1
        AND COALESCE(stock.stockQuantityBase, 0) >= pu.conversion_factor
      ORDER BY p.product_id ASC
      LIMIT 1
    `);
    const product = products[0];
    if (!product) throw new Error("ไม่พบสินค้าที่มีสต็อกเพียงพอสำหรับจำลองการขาย");

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const token = createAuthToken(userId, "owner");

    const order = await api<OrderResponse>(baseUrl, token, "/orders", {
      method: "POST",
      body: JSON.stringify({
        paymentMethod: "cash",
        amountReceived: Number(product.price) + 100,
        customerId: customer.id,
        items: [{ productId: product.id, quantity: 1 }],
      }),
    });

    await connection.query(
      "UPDATE sales SET sold_at = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE sale_no = ?",
      [order.orderNumber],
    );
    await connection.query(`
      UPDATE sale_payments payment
      INNER JOIN sales sale ON sale.sale_id = payment.sale_id
      SET payment.paid_at = sale.sold_at
      WHERE sale.sale_no = ?
    `, [order.orderNumber]);
    await connection.query(`
      UPDATE cash_transactions transaction_row
      INNER JOIN sale_payments payment ON payment.sale_payment_id = transaction_row.sale_payment_id
      INNER JOIN sales sale ON sale.sale_id = payment.sale_id
      SET transaction_row.transaction_date = DATE(sale.sold_at),
          transaction_row.transaction_time = sale.sold_at
      WHERE sale.sale_no = ?
    `, [order.orderNumber]);
    await connection.query(`
      UPDATE stock_movements movement
      INNER JOIN sale_items item ON item.sale_item_id = movement.sale_item_id
      INNER JOIN sales sale ON sale.sale_id = item.sale_id
      SET movement.moved_at = sale.sold_at
      WHERE sale.sale_no = ?
    `, [order.orderNumber]);

    const recommendations = await api<RecommendationResponse>(baseUrl, token, "/recommendations?inactivityDays=3");
    const inactiveCustomer = recommendations.customers.find((row) => row.customerId === customer.id);
    if (!inactiveCustomer) throw new Error("ลูกค้าหลังจำลองการซื้อไม่ปรากฏในรายการแนะนำ");
    if (inactiveCustomer.daysSinceLastPurchase < 3) throw new Error("ระบบคำนวณจำนวนวันที่ลูกค้าหายไปไม่ถึง 3 วัน");
    if (!inactiveCustomer.products.some((row) => row.productId === product.id)) throw new Error("สินค้าในบิลจำลองไม่ปรากฏในสินค้าที่แนะนำให้ลูกค้า");

    const receipt = await api<{ orderNumber: string; payments: Array<{ method: string; amountReceived: number; changeAmount: number }> }>(baseUrl, token, `/orders/${order.orderNumber}`);
    if (receipt.payments[0]?.method !== "cash") throw new Error("ใบเสร็จจำลองไม่พบการชำระเงินสด");

    console.log(JSON.stringify({
      success: true,
      message: "จำลองการซื้อจริง ปรับวันที่ย้อนหลัง และตรวจพบในคำแนะนำลูกค้าที่หายไปแล้ว",
      customer: { id: customer.id, name: customer.name },
      orderNumber: order.orderNumber,
      product: { id: product.id, name: product.name },
      payment: { method: order.paymentMethod, total: order.total, amountReceived: order.amountReceived, changeAmount: order.changeAmount },
      lastPurchaseMovedBackDays: 4,
      detectedAfterDays: inactiveCustomer.daysSinceLastPurchase,
      recommendationProducts: inactiveCustomer.products,
      note: "รายการนี้คงอยู่ในฐานข้อมูล และสต็อกถูกตัดตามการขายจริง 1 หน่วย",
    }, null, 2));
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => error ? reject(error) : resolve());
      });
    }
    await connection.end();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
