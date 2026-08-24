import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mysql, { RowDataPacket } from "mysql2/promise";
import { env } from "../config/env";

async function columnExists(connection: mysql.Connection, tableName: string, columnName: string) {
  const [rows] = await connection.query<Array<RowDataPacket & { count: number }>>(`
    SELECT COUNT(*) AS count
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
  `, [tableName, columnName]);
  return Number(rows[0]?.count ?? 0) > 0;
}

async function constraintExists(connection: mysql.Connection, tableName: string, constraintName: string) {
  const [rows] = await connection.query<Array<RowDataPacket & { count: number }>>(`
    SELECT COUNT(*) AS count
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ?
  `, [tableName, constraintName]);
  return Number(rows[0]?.count ?? 0) > 0;
}

async function initializeDatabase() {
  if (!/^[a-zA-Z0-9_]+$/.test(env.database.name)) {
    throw new Error("DB_NAME ใช้ได้เฉพาะตัวอักษร ตัวเลข และ underscore");
  }

  // The API uses the normalized schema exported from MySQL Workbench.
  // database/schema.sql is an older, incompatible schema kept for reference.
  const schema = await readFile(resolve(process.cwd(), "database/pro.corrected.sql"), "utf8");
  const connection = await mysql.createConnection({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    multipleStatements: true,
    charset: "utf8mb4",
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.database.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${env.database.name}\``);
    await connection.query(schema);
    if (!(await columnExists(connection, "products", "supplier_id"))) {
      await connection.query("ALTER TABLE products ADD COLUMN supplier_id INT UNSIGNED NULL AFTER category_id");
    }
    if (!(await columnExists(connection, "products", "image_url"))) {
      await connection.query("ALTER TABLE products ADD COLUMN image_url VARCHAR(500) NULL AFTER reorder_point");
    }
    if (!(await columnExists(connection, "products", "image_public_id"))) {
      await connection.query("ALTER TABLE products ADD COLUMN image_public_id VARCHAR(255) NULL AFTER image_url");
    }
    if (!(await constraintExists(connection, "products", "fk_products_supplier"))) {
      await connection.query(`
        ALTER TABLE products
        ADD CONSTRAINT fk_products_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (supplier_id)
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
    }
    for (const roleName of ["owner", "cashier", "stock"]) {
      await connection.query(
        "INSERT INTO roles (role_name) VALUES (?) ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)",
        [roleName],
      );
    }
    const [ownerRoles] = await connection.query<Array<RowDataPacket & { role_id: number }>>(
      "SELECT role_id FROM roles WHERE role_name = 'owner' LIMIT 1",
    );
    const ownerRoleId = ownerRoles[0]?.role_id;
    if (!ownerRoleId) throw new Error("ไม่พบ role owner หลังสร้าง schema");

    await connection.query(`
      INSERT INTO users (role_id, full_name, username, password_hash, status)
      VALUES (?, 'กัปตันอูด้ง', 'captain@gmail.com', 'scrypt:captain-gai-sod:da6ae01ee6a2fd50283b67c264b4f8f91e42826edf2ed351efe189ee159fdaa9af7b8af5bfa0ad46d3d90f6ec137088985a9fe31f6d04f47989b08ff7354c365', 'ACTIVE')
      ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), full_name = VALUES(full_name), status = 'ACTIVE'
    `, [ownerRoleId]);
    await connection.query(`
      INSERT INTO categories (category_name) VALUES ('วัตถุดิบ'), ('เครื่องปรุง'), ('บรรจุภัณฑ์')
      ON DUPLICATE KEY UPDATE category_name = VALUES(category_name)
    `);
    console.log(`Database ${env.database.name} is ready (Workbench schema + default roles/categories)`);
  } finally {
    await connection.end();
  }
}

initializeDatabase().catch((error) => {
  console.error("Database initialization failed", error);
  process.exit(1);
});
