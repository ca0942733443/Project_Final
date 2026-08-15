import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { createAuthToken } from "../utils/auth-token";
import { asyncHandler } from "../utils/async-handler";
import { verifyPassword } from "../utils/password";

const authRoles = ["owner", "cashier", "stock"] as const;
type AuthRole = typeof authRoles[number];

interface UserAuthRow extends RowDataPacket {
  id: number;
  username: string;
  passwordHash: string;
  fullName: string;
  role: string;
}

export const authRouter = Router();

function isAuthRole(role: string): role is AuthRole {
  return authRoles.includes(role as AuthRole);
}

authRouter.post("/login", asyncHandler(async (request, response) => {
  const body = request.body as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) throw new ApiError(400, "กรุณาระบุอีเมลและรหัสผ่าน");

  const [users] = await pool.query<UserAuthRow[]>(`
    SELECT
      u.user_id AS id,
      u.username,
      u.password_hash AS passwordHash,
      u.full_name AS fullName,
      LOWER(r.role_name) AS role
    FROM users u
    INNER JOIN roles r ON r.role_id = u.role_id
    WHERE u.username = ? AND u.status = 'ACTIVE'
    LIMIT 1
  `, [email]);
  const user = users[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }
  if (!isAuthRole(user.role)) {
    throw new ApiError(403, "บัญชีนี้ไม่มีบทบาทที่ระบบรองรับ");
  }

  await pool.execute("UPDATE users SET last_login_at = NOW() WHERE user_id = ?", [user.id]);

  response.json({
    success: true,
    data: {
      token: createAuthToken(user.id, user.role),
      user: { id: user.id, email: user.username, fullName: user.fullName, role: user.role },
    },
  });
}));
