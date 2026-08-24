import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";

interface SupplierRow extends RowDataPacket {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
}

type SupplierInput = {
  name?: unknown;
  phone?: unknown;
  address?: unknown;
};

export const suppliersRouter = Router();

function requiredText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, `กรุณาระบุ${fieldName}`);
  }
  return value.trim();
}

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim().slice(0, maxLength);
}

suppliersRouter.get("/", asyncHandler(async (request, response) => {
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const values: string[] = [];
  const condition = search ? "WHERE s.supplier_name LIKE ? OR s.phone LIKE ?" : "";
  if (search) values.push(`%${search}%`, `%${search}%`);

  const [suppliers] = await pool.query<SupplierRow[]>(`
    SELECT
      s.supplier_id AS id,
      s.supplier_name AS name,
      s.phone,
      s.address
    FROM suppliers s
    ${condition}
    ORDER BY s.supplier_name ASC, s.supplier_id ASC
  `, values);
  response.json({ success: true, data: suppliers });
}));

suppliersRouter.post("/", asyncHandler(async (request, response) => {
  const body = request.body as SupplierInput;
  const name = requiredText(body.name, "ชื่อผู้จำหน่าย").slice(0, 200);
  const phone = optionalText(body.phone, 30);
  const address = optionalText(body.address, 65535);

  const [duplicates] = await pool.query<Array<RowDataPacket & { id: number }>>(`
    SELECT supplier_id AS id
    FROM suppliers
    WHERE LOWER(supplier_name) = LOWER(?)
    LIMIT 1
  `, [name]);
  if (duplicates[0]) throw new ApiError(409, "มีผู้จำหน่ายชื่อนี้อยู่แล้ว");

  const [result] = await pool.execute<ResultSetHeader>(`
    INSERT INTO suppliers (supplier_name, phone, address)
    VALUES (?, ?, ?)
  `, [name, phone, address]);
  response.status(201).json({
    success: true,
    data: { id: result.insertId, name, phone, address },
  });
}));
