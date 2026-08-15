import mysql from "mysql2/promise";
import { env } from "../config/env";

export const pool = mysql.createPool({
  host: env.database.host,
  port: env.database.port,
  user: env.database.user,
  password: env.database.password,
  database: env.database.name,
  waitForConnections: true,
  connectionLimit: env.database.connectionLimit,
  queueLimit: 0,
  decimalNumbers: true,
  charset: "utf8mb4",
});

export async function checkDatabaseConnection() {
  await pool.query("SELECT 1");
}
