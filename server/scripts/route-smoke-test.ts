import "dotenv/config";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import mysql from "mysql2/promise";
import { app } from "../app";
import { env } from "../config/env";
import { pool } from "../db/pool";

let apiBase = "";
const marker = Date.now().toString(36);
const categoryName = `__route_test_category_${marker}`;
const supplierName = `__route_test_supplier_${marker}`;
const sku = `ROUTE-${marker}`.toUpperCase();
const phone = `09${String(Date.now()).slice(-8)}`;
const employeeEmail = `route-test-${marker}@example.com`;

type ApiEnvelope<T> = { success: boolean; data: T };

async function api<T>(path: string, token?: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const text = await response.text();
  const payload = text ? JSON.parse(text) as ApiEnvelope<T> & { error?: string } : null;
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${response.status}: ${payload?.error ?? text}`);
  return payload?.data as T;
}

async function cleanup(connection: mysql.Connection) {
  const [productRows] = await connection.query<Array<mysql.RowDataPacket & { id: number }>>(
    "SELECT product_id AS id FROM products WHERE sku = ?",
    [sku],
  );
  const productId = productRows[0]?.id;
  if (productId) {
    const [saleRows] = await connection.query<Array<mysql.RowDataPacket & { id: number }>>(`
      SELECT DISTINCT si.sale_id AS id
      FROM sale_items si
      INNER JOIN product_units pu ON pu.product_unit_id = si.product_unit_id
      WHERE pu.product_id = ?
    `, [productId]);
    const saleIds = saleRows.map((row) => row.id);
    const [receiptRows] = await connection.query<Array<mysql.RowDataPacket & { id: number }>>(
      "SELECT DISTINCT receipt_id AS id FROM goods_receipt_items WHERE product_id = ?",
      [productId],
    );
    const receiptIds = receiptRows.map((row) => row.id);

    await connection.query(`
      DELETE sm FROM stock_movements sm
      INNER JOIN product_batches pb ON pb.batch_id = sm.batch_id
      WHERE pb.product_id = ?
    `, [productId]);
    if (saleIds.length) {
      await connection.query(`
        DELETE ct FROM cash_transactions ct
        INNER JOIN sale_payments sp ON sp.sale_payment_id = ct.sale_payment_id
        WHERE sp.sale_id IN (?)
      `, [saleIds]);
      await connection.query("DELETE FROM credit_invoices WHERE sale_id IN (?)", [saleIds]);
      await connection.query("DELETE FROM sale_payments WHERE sale_id IN (?)", [saleIds]);
      await connection.query("DELETE FROM sale_items WHERE sale_id IN (?)", [saleIds]);
      await connection.query("DELETE FROM sales WHERE sale_id IN (?)", [saleIds]);
    }
    await connection.query("DELETE FROM product_batches WHERE product_id = ?", [productId]);
    await connection.query("DELETE FROM goods_receipt_items WHERE product_id = ?", [productId]);
    if (receiptIds.length) await connection.query("DELETE FROM goods_receipts WHERE receipt_id IN (?)", [receiptIds]);
    await connection.query("DELETE FROM product_units WHERE product_id = ?", [productId]);
    await connection.query("DELETE FROM products WHERE product_id = ?", [productId]);
  }

  await connection.query("DELETE FROM customers WHERE phone = ?", [phone]);
  await connection.query("DELETE FROM users WHERE username = ?", [employeeEmail]);
  await connection.query("DELETE FROM categories WHERE category_name = ?", [categoryName]);
  await connection.query(`
    DELETE FROM suppliers
    WHERE supplier_name IN (?, ?)
      AND NOT EXISTS (SELECT 1 FROM goods_receipts WHERE goods_receipts.supplier_id = suppliers.supplier_id)
  `, ["ผู้จำหน่ายทั่วไป", supplierName]);
  await connection.query(`
    DELETE FROM cash_categories
    WHERE category_name = ?
      AND NOT EXISTS (
        SELECT 1 FROM cash_transactions
        WHERE cash_transactions.cash_category_id = cash_categories.cash_category_id
      )
  `, ["รายได้จากการขาย"]);
  await connection.query(`
    DELETE FROM roles
    WHERE role_name IN ('cashier', 'stock')
      AND NOT EXISTS (SELECT 1 FROM users WHERE users.role_id = roles.role_id)
  `);
  await connection.query("DELETE FROM location WHERE location_id = 1 AND location_name = ? AND NOT EXISTS (SELECT 1 FROM customers WHERE location_location_id = 1)", ["ไม่ระบุ"]);
  await connection.query("DELETE FROM car_type WHERE car_type_id = 1 AND ca_rtype_name = ? AND NOT EXISTS (SELECT 1 FROM customers WHERE car_type_car_type_id = 1)", ["ไม่ระบุ"]);
}

async function run() {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  apiBase = `http://127.0.0.1:${address.port}/api`;
  let connection: mysql.Connection | undefined;

  try {
    connection = await mysql.createConnection({
      host: env.database.host,
      port: env.database.port,
      user: env.database.user,
      password: env.database.password,
      database: env.database.name,
      decimalNumbers: true,
      charset: "utf8mb4",
    });
    await cleanup(connection);
    const [category] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO categories (category_name) VALUES (?)",
      [categoryName],
    );
    const login = await api<{ token: string }>("/auth/login", undefined, {
      method: "POST",
      body: JSON.stringify({ email: "captain@gmail.com", password: "captain123" }),
    });
    const token = login.token;

    const supplier = await api<{ id: number }>("/suppliers", token, {
      method: "POST",
      body: JSON.stringify({ name: supplierName, phone: "089-000-0000", address: "Route test address" }),
    });
    const supplierRows = await api<Array<{ id: number }>>(`/suppliers?search=${encodeURIComponent(supplierName)}`, token);
    if (!supplierRows.some((row) => row.id === supplier.id)) throw new Error("Supplier was not returned by search");

    const employee = await api<{ id: number }>("/employees", token, {
      method: "POST",
      body: JSON.stringify({
        email: employeeEmail,
        password: "RouteTest123!",
        fullName: "Route Test Employee",
        role: "cashier",
      }),
    });
    await api(`/employees/${employee.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ fullName: "Route Test Updated", role: "stock" }),
    });
    await api(`/employees/${employee.id}`, token, { method: "DELETE" });

    const customer = await api<{ id: number }>("/customers", token, {
      method: "POST",
      body: JSON.stringify({
        customerCode: `TEST-${marker}`,
        fullName: "Route Test Customer",
        phone,
        creditLimit: 1000,
      }),
    });
    await api(`/customers/${customer.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ fullName: "Route Test Customer Updated", creditLimit: 1200 }),
    });

    const product = await api<{ id: number }>("/products", token, {
      method: "POST",
      body: JSON.stringify({
        sku,
        name: "Route Test Product",
        categoryId: category.insertId,
        supplierId: supplier.id,
        price: 50,
        unit: "ชิ้น",
        stockQuantity: 20,
        lowStockThreshold: 5,
      }),
    });
    await api(`/products/${product.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ name: "Route Test Product Updated", price: 55, stockQuantity: 18 }),
    });
    await api("/inventory/movements", token, {
      method: "POST",
      body: JSON.stringify({ productId: product.id, movementType: "purchase", quantity: 2, supplierId: supplier.id, unitCost: 40, note: marker }),
    });

    const cashSale = await api<{ orderNumber: string }>("/orders", token, {
      method: "POST",
      body: JSON.stringify({ paymentMethod: "cash", amountReceived: 200, items: [{ productId: product.id, quantity: 2 }] }),
    });
    const qrSale = await api<{ orderNumber: string }>("/orders", token, {
      method: "POST",
      body: JSON.stringify({ paymentMethod: "qr", items: [{ productId: product.id, quantity: 1 }] }),
    });
    const creditSale = await api<{ orderNumber: string }>("/orders", token, {
      method: "POST",
      body: JSON.stringify({ paymentMethod: "credit", customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] }),
    });

    await api(`/orders/${cashSale.orderNumber}`, token);
    await api(`/orders/${qrSale.orderNumber}`, token);
    await api(`/orders/${creditSale.orderNumber}`, token);
    await api("/orders?paymentMethod=cash", token);
    await api("/orders?paymentMethod=qr", token);
    await api("/orders?paymentMethod=credit", token);
    await api("/dashboard?period=day", token);
    await api("/inventory", token);
    await api("/inventory/movements", token);
    await api("/customers", token);
    await api("/customers/stats", token);
    await api("/employees", token);
    await api("/employees/stats", token);
    await api("/categories", token);
    await api("/products", token);

    await api(`/customers/${customer.id}`, token, { method: "DELETE" });
    await api(`/products/${product.id}`, token, { method: "DELETE" });
    console.log(JSON.stringify({
      success: true,
      tested: [
        "employees POST/PATCH/DELETE",
        "customers POST/PATCH/DELETE",
        "suppliers GET/POST",
        "products POST/GET/PATCH/DELETE",
        "inventory GET/POST",
        "orders cash/qr/credit POST/GET",
        "dashboard/categories read routes",
      ],
    }));
  } finally {
    if (connection) {
      await cleanup(connection);
      await connection.end();
    }
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
