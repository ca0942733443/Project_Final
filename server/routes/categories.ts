import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { asyncHandler } from "../utils/async-handler";

interface CategoryRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  productCount: number;
}

export const categoriesRouter = Router();

categoriesRouter.get("/", asyncHandler(async (_request, response) => {
  const [categories] = await pool.query<CategoryRow[]>(`
    SELECT
      c.category_id AS id,
      c.category_name AS name,
      CAST(c.category_id AS CHAR) AS slug,
      COUNT(p.product_id) AS productCount
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.category_id AND p.is_active = 1
    GROUP BY c.category_id, c.category_name
    ORDER BY c.category_name ASC
  `);

  response.json({ success: true, data: categories });
}));
