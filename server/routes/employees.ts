import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";
import { hashPassword } from "../utils/password";

const roles = ["owner", "cashier", "stock"] as const;
type EmployeeRole = typeof roles[number];

interface EmployeeRow extends RowDataPacket {
  id: number;
  email: string;
  fullName: string;
  role: EmployeeRole;
  isActive: number;
  createdAt: Date | null;
}

interface EmployeeStatsRow extends RowDataPacket {
  totalEmployees: number;
  activeEmployees: number;
  owners: number;
  cashiers: number;
  stockStaff: number;
}

type EmployeeInput = {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
  role?: unknown;
  isActive?: unknown;
};

export const employeesRouter = Router();

function requiredText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, `กรุณาระบุ ${fieldName}`);
  }
  return value.trim();
}

function employeeRole(value: unknown): EmployeeRole {
  const role = typeof value === "string" ? value.toLowerCase() : "";
  if (!roles.includes(role as EmployeeRole)) throw new ApiError(400, "บทบาทพนักงานไม่ถูกต้อง");
  return role as EmployeeRole;
}

async function passwordHash(value: unknown) {
  const password = requiredText(value, "รหัสผ่าน");
  if (password.length < 8) throw new ApiError(400, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  return hashPassword(password);
}

employeesRouter.get("/stats", asyncHandler(async (_request, response) => {
  const [rows] = await pool.query<EmployeeStatsRow[]>(`
    SELECT
      COUNT(*) AS totalEmployees,
      COALESCE(SUM(u.status = 'ACTIVE'), 0) AS activeEmployees,
      COALESCE(SUM(LOWER(r.role_name) = 'owner' AND u.status = 'ACTIVE'), 0) AS owners,
      COALESCE(SUM(LOWER(r.role_name) = 'cashier' AND u.status = 'ACTIVE'), 0) AS cashiers,
      COALESCE(SUM(LOWER(r.role_name) = 'stock' AND u.status = 'ACTIVE'), 0) AS stockStaff
    FROM users u
    INNER JOIN roles r ON r.role_id = u.role_id
  `);
  response.json({ success: true, data: rows[0] });
}));

employeesRouter.get("/", asyncHandler(async (request, response) => {
  const includeInactive = request.query.includeInactive === "true";
  const [employees] = await pool.query<EmployeeRow[]>(`
    SELECT
      u.user_id AS id,
      u.username AS email,
      u.full_name AS fullName,
      LOWER(r.role_name) AS role,
      (u.status = 'ACTIVE') AS isActive,
      u.last_login_at AS createdAt
    FROM users u
    INNER JOIN roles r ON r.role_id = u.role_id
    ${includeInactive ? "" : "WHERE u.status = 'ACTIVE'"}
    ORDER BY u.full_name ASC
  `);
  response.json({ success: true, data: employees });
}));

employeesRouter.post("/", asyncHandler(async (request, response) => {
  const body = request.body as EmployeeInput;
  const email = requiredText(body.email, "อีเมล").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, "รูปแบบอีเมลไม่ถูกต้อง");
  const fullName = requiredText(body.fullName, "ชื่อพนักงาน");
  const role = employeeRole(body.role ?? "cashier");
  const hashedPassword = await passwordHash(body.password);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [roleResult] = await connection.execute<ResultSetHeader>(`
      INSERT INTO roles (role_name)
      VALUES (?)
      ON DUPLICATE KEY UPDATE role_id = LAST_INSERT_ID(role_id)
    `, [role]);
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO users (role_id, full_name, username, password_hash, status)
      VALUES (?, ?, ?, ?, 'ACTIVE')
    `, [roleResult.insertId, fullName, email, hashedPassword]);
    await connection.commit();
    response.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

employeesRouter.patch("/:id", asyncHandler(async (request, response) => {
  const userId = Number(request.params.id);
  if (!Number.isInteger(userId) || userId <= 0) throw new ApiError(400, "รหัสพนักงานไม่ถูกต้อง");
  const body = request.body as EmployeeInput;
  const updates: string[] = [];
  const values: Array<string | number> = [];
  const setValue = (column: string, value: string | number) => {
    updates.push(`${column} = ?`);
    values.push(value);
  };

  if (body.email !== undefined) {
    const email = requiredText(body.email, "อีเมล").toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, "รูปแบบอีเมลไม่ถูกต้อง");
    setValue("username", email);
  }
  if (body.fullName !== undefined) setValue("full_name", requiredText(body.fullName, "ชื่อพนักงาน"));
  if (body.password !== undefined) setValue("password_hash", await passwordHash(body.password));
  if (body.isActive !== undefined) setValue("status", body.isActive ? "ACTIVE" : "SUSPENDED");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (body.role !== undefined) {
      const role = employeeRole(body.role);
      const [roleResult] = await connection.execute<ResultSetHeader>(`
        INSERT INTO roles (role_name)
        VALUES (?)
        ON DUPLICATE KEY UPDATE role_id = LAST_INSERT_ID(role_id)
      `, [role]);
      setValue("role_id", roleResult.insertId);
    }
    if (updates.length === 0) throw new ApiError(400, "ไม่มีข้อมูลสำหรับแก้ไข");
    values.push(userId);
    const [result] = await connection.execute<ResultSetHeader>(`
      UPDATE users SET ${updates.join(", ")} WHERE user_id = ?
    `, values);
    if (result.affectedRows === 0) throw new ApiError(404, "ไม่พบพนักงาน");
    await connection.commit();
    response.json({ success: true });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

employeesRouter.delete("/:id", asyncHandler(async (request, response) => {
  const userId = Number(request.params.id);
  if (!Number.isInteger(userId) || userId <= 0) throw new ApiError(400, "รหัสพนักงานไม่ถูกต้อง");
  const [result] = await pool.execute<ResultSetHeader>(`
    UPDATE users SET status = 'SUSPENDED'
    WHERE user_id = ? AND status = 'ACTIVE'
  `, [userId]);
  if (result.affectedRows === 0) throw new ApiError(404, "ไม่พบพนักงาน");
  response.status(204).send();
}));
