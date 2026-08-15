import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { env } from "../config/env";

async function initializeDatabase() {
  if (!/^[a-zA-Z0-9_]+$/.test(env.database.name)) {
    throw new Error("DB_NAME ใช้ได้เฉพาะตัวอักษร ตัวเลข และ underscore");
  }

  const schema = await readFile(resolve(process.cwd(), "database/schema.sql"), "utf8");
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
    console.log(`Database ${env.database.name} is ready`);
  } finally {
    await connection.end();
  }
}

initializeDatabase().catch((error) => {
  console.error("Database initialization failed", error);
  process.exit(1);
});
