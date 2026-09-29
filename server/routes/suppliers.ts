import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";

interface SupplierRow extends RowDataPacket {
  id: number;
  name: string;
  phone: string | null;
  lineId: string | null;
  productsSupplied: string | null;
  address: string | null;
}

type SupplierInput = {
  name?: unknown;
  phone?: unknown;
  lineId?: unknown;
  productsSupplied?: unknown;
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

function supplierInput(body: SupplierInput) {
  return {
    name: requiredText(body.name, "ชื่อผู้จำหน่าย").slice(0, 200),
    phone: optionalText(body.phone, 30),
    lineId: optionalText(body.lineId, 100),
    productsSupplied: optionalText(body.productsSupplied, 65535),
    address: optionalText(body.address, 65535),
  };
}

async function findSupplier(id: number) {
  const [suppliers] = await pool.query<SupplierRow[]>(`
    SELECT
      s.supplier_id AS id,
      s.supplier_name AS name,
      s.phone,
      s.line_id AS lineId,
      s.products_supplied AS productsSupplied,
      s.address
    FROM suppliers s
    WHERE s.supplier_id = ?
  `, [id]);
  return suppliers[0];
}

suppliersRouter.get("/", asyncHandler(async (request, response) => {
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const values: string[] = [];
  const condition = search
    ? "WHERE s.supplier_name LIKE ? OR s.phone LIKE ? OR s.line_id LIKE ? OR s.products_supplied LIKE ?"
    : "";
  if (search) values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);

  const [suppliers] = await pool.query<SupplierRow[]>(`
    SELECT
      s.supplier_id AS id,
      s.supplier_name AS name,
      s.phone,
      s.line_id AS lineId,
      s.products_supplied AS productsSupplied,
      s.address
    FROM suppliers s
    ${condition}
    ORDER BY s.supplier_name ASC, s.supplier_id ASC
  `, values);
  response.json({ success: true, data: suppliers });
}));

suppliersRouter.get("/:id", asyncHandler(async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, "รหัสผู้จำหน่ายไม่ถูกต้อง");

  const supplier = await findSupplier(id);
  if (!supplier) throw new ApiError(404, "ไม่พบผู้จำหน่าย");
  response.json({ success: true, data: supplier });
}));

suppliersRouter.post("/", asyncHandler(async (request, response) => {
  const body = request.body as SupplierInput;
  const { name, phone, lineId, productsSupplied, address } = supplierInput(body);

  const [duplicates] = await pool.query<Array<RowDataPacket & { id: number }>>(`
    SELECT supplier_id AS id
    FROM suppliers
    WHERE LOWER(supplier_name) = LOWER(?)
    LIMIT 1
  `, [name]);
  if (duplicates[0]) throw new ApiError(409, "มีผู้จำหน่ายชื่อนี้อยู่แล้ว");

  const [result] = await pool.execute<ResultSetHeader>(`
    INSERT INTO suppliers (supplier_name, phone, line_id, products_supplied, address)
    VALUES (?, ?, ?, ?, ?)
  `, [name, phone, lineId, productsSupplied, address]);
  response.status(201).json({
    success: true,
    data: { id: result.insertId, name, phone, lineId, productsSupplied, address },
  });
}));

suppliersRouter.put("/:id", asyncHandler(async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, "รหัสผู้จำหน่ายไม่ถูกต้อง");

  const { name, phone, lineId, productsSupplied, address } = supplierInput(request.body as SupplierInput);
  const [result] = await pool.execute<ResultSetHeader>(`
    UPDATE suppliers
    SET supplier_name = ?, phone = ?, line_id = ?, products_supplied = ?, address = ?
    WHERE supplier_id = ?
  `, [name, phone, lineId, productsSupplied, address, id]);
  if (result.affectedRows === 0) throw new ApiError(404, "ไม่พบผู้จำหน่าย");

  response.json({ success: true, data: { id, name, phone, lineId, productsSupplied, address } });
}));

suppliersRouter.delete("/:id", asyncHandler(async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, "รหัสผู้จำหน่ายไม่ถูกต้อง");

  const [result] = await pool.execute<ResultSetHeader>("DELETE FROM suppliers WHERE supplier_id = ?", [id]);
  if (result.affectedRows === 0) throw new ApiError(404, "ไม่พบผู้จำหน่าย");
  response.status(204).send();
}));
