import { Router, Request, Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { asyncHandler } from "../utils/async-handler";

interface Level3CategoryRow extends RowDataPacket {
  id: number;
  subCategoryId: number;
  name: string;
  isProduct: boolean;
}

interface SubCategoryRow extends RowDataPacket {
  id: number;
  categoryId: number;
  name: string;
  subCategories?: Level3CategoryRow[];
}

interface CategoryRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  productCount: number;
  subCategories?: SubCategoryRow[];
}

export const categoriesRouter = Router();

/*
|--------------------------------------------------------------------------
| GET /api/categories
| ดึงหมวดหมู่ทั้ง 3 ระดับ
|--------------------------------------------------------------------------
*/
categoriesRouter.get(
  "/",
  asyncHandler(async (_request: Request, response: Response) => {
    // =========================================================
    // LEVEL 1 : categories
    // =========================================================
    const [categories] = await pool.query<CategoryRow[]>(`
      SELECT
        c.category_id AS id,
        c.category_name AS name,
        CAST(c.category_id AS CHAR) AS slug,
        COUNT(p.product_id) AS productCount
      FROM categories c
      LEFT JOIN products p
        ON p.category_id = c.category_id
        AND p.is_active = 1
      WHERE c.is_active = 1
      GROUP BY
        c.category_id,
        c.category_name
      ORDER BY c.category_name ASC
    `);

    // =========================================================
    // LEVEL 2 : sub_categories
    // =========================================================
    const [subCategories] = await pool.query<SubCategoryRow[]>(`
      SELECT
        sub_category_id AS id,
        category_id AS categoryId,
        sub_category_name AS name
      FROM sub_categories
      WHERE is_active = 1
      ORDER BY sub_category_name ASC
    `);

    // =========================================================
    // LEVEL 3 : สินค้าที่เพิ่มจากหน้าจัดการสินค้า
    // =========================================================
    const [products] = await pool.query<Level3CategoryRow[]>(`
      SELECT
        p.product_id AS id,
        p.sub_category_id AS subCategoryId,
        p.product_name AS name,
        TRUE AS isProduct
      FROM products p
      WHERE p.is_active = 1 AND p.sub_category_id IS NOT NULL
      ORDER BY p.product_name ASC, p.product_id ASC
    `);

    // =========================================================
    // เอา Level 3 ไปอยู่ใต้ Level 2
    // =========================================================
    const level2 = subCategories.map((sub) => ({
      ...sub,
      subCategories: products.filter(
        (product) => product.subCategoryId === sub.id
      ),
    }));

    // =========================================================
    // เอา Level 2 ไปอยู่ใต้ Level 1
    // =========================================================
    const result = categories.map((cat) => ({
      ...cat,
      subCategories: level2.filter(
        (sub) => sub.categoryId === cat.id
      ),
    }));

    response.json({
      success: true,
      data: result,
    });
  })
);

/*
|--------------------------------------------------------------------------
| POST /api/categories
| เพิ่ม Level 1
|--------------------------------------------------------------------------
*/
categoriesRouter.post(
  "/",
  asyncHandler(async (request: Request, response: Response) => {
    const { name } = request.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return response.status(400).json({
        success: false,
        message: "กรุณาระบุชื่อหมวดหมู่",
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `
      INSERT INTO categories (category_name)
      VALUES (?)
      `,
      [name.trim()]
    );

    response.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name: name.trim(),
        slug: String(result.insertId),
        productCount: 0,
        subCategories: [],
      },
    });
  })
);

/*
|--------------------------------------------------------------------------
| PUT /api/categories/:id
| แก้ไข Level 1
|--------------------------------------------------------------------------
*/
categoriesRouter.put(
  "/:id",
  asyncHandler(async (request: Request, response: Response) => {
    const { id } = request.params;
    const { name } = request.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return response.status(400).json({
        success: false,
        message: "กรุณาระบุชื่อหมวดหมู่",
      });
    }

    await pool.query(
      `
      UPDATE categories
      SET category_name = ?
      WHERE category_id = ?
      `,
      [name.trim(), id]
    );

    response.json({
      success: true,
      message: "แก้ไขหมวดหมู่สำเร็จ",
    });
  })
);

/*
|--------------------------------------------------------------------------
| DELETE /api/categories/:id
| ลบ Level 1
|--------------------------------------------------------------------------
*/
categoriesRouter.delete(
  "/:id",
  asyncHandler(async (request: Request, response: Response) => {
    const categoryId = Number(request.params.id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return response.status(400).json({ success: false, message: "รหัสหมวดหมู่ไม่ถูกต้อง" });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [categoryResult] = await connection.query<ResultSetHeader>(`
        UPDATE categories SET is_active = 0
        WHERE category_id = ? AND is_active = 1
      `, [categoryId]);
      if (categoryResult.affectedRows === 0) {
        await connection.rollback();
        return response.status(404).json({ success: false, message: "ไม่พบหมวดหมู่" });
      }
      await connection.query("UPDATE sub_categories SET is_active = 0 WHERE category_id = ?", [categoryId]);
      await connection.query("UPDATE products SET is_active = 0 WHERE category_id = ?", [categoryId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    response.json({
      success: true,
      message: "ลบหมวดหมู่และซ่อนสินค้าที่อยู่ภายในสำเร็จ",
    });
  })
);

/*
|--------------------------------------------------------------------------
| POST /api/categories/:categoryId/subcategories
| เพิ่ม Level 2
|--------------------------------------------------------------------------
*/
categoriesRouter.post(
  "/:categoryId/subcategories",
  asyncHandler(async (request: Request, response: Response) => {
    const { categoryId } = request.params;
    const { name } = request.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return response.status(400).json({
        success: false,
        message: "กรุณาระบุชื่อหมวดหมู่ระดับ 2",
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `
      INSERT INTO sub_categories
        (category_id, sub_category_name)
      VALUES (?, ?)
      `,
      [categoryId, name.trim()]
    );

    response.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        categoryId: Number(categoryId),
        name: name.trim(),
        subCategories: [],
      },
    });
  })
);

/*
|--------------------------------------------------------------------------
| PUT /api/categories/:categoryId/subcategories/:subId
| แก้ไข Level 2
|--------------------------------------------------------------------------
*/
categoriesRouter.put(
  "/:categoryId/subcategories/:subId",
  asyncHandler(async (request: Request, response: Response) => {
    const { subId } = request.params;
    const { name } = request.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return response.status(400).json({
        success: false,
        message: "กรุณาระบุชื่อหมวดหมู่ระดับ 2",
      });
    }

    await pool.query(
      `
      UPDATE sub_categories
      SET sub_category_name = ?
      WHERE sub_category_id = ?
      `,
      [name.trim(), subId]
    );

    response.json({
      success: true,
      message: "แก้ไขหมวดหมู่ระดับ 2 สำเร็จ",
    });
  })
);

/*
|--------------------------------------------------------------------------
| DELETE /api/categories/:categoryId/subcategories/:subId
| ลบ Level 2
|--------------------------------------------------------------------------
*/
categoriesRouter.delete(
  "/:categoryId/subcategories/:subId",
  asyncHandler(async (request: Request, response: Response) => {
    const categoryId = Number(request.params.categoryId);
    const subCategoryId = Number(request.params.subId);
    if (!Number.isInteger(categoryId) || categoryId <= 0 || !Number.isInteger(subCategoryId) || subCategoryId <= 0) {
      return response.status(400).json({ success: false, message: "รหัสหมวดหมู่ย่อยไม่ถูกต้อง" });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [subCategoryResult] = await connection.query<ResultSetHeader>(`
        UPDATE sub_categories SET is_active = 0
        WHERE sub_category_id = ? AND category_id = ? AND is_active = 1
      `, [subCategoryId, categoryId]);
      if (subCategoryResult.affectedRows === 0) {
        await connection.rollback();
        return response.status(404).json({ success: false, message: "ไม่พบหมวดหมู่ย่อย" });
      }
      await connection.query("UPDATE products SET is_active = 0 WHERE sub_category_id = ?", [subCategoryId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    response.json({
      success: true,
      message: "ลบหมวดหมู่ย่อยและซ่อนสินค้าที่อยู่ภายในสำเร็จ",
    });
  })
);

/*
|--------------------------------------------------------------------------
| POST
| /api/categories/:categoryId/subcategories/:subCategoryId/items
|
| เพิ่ม Level 3
|--------------------------------------------------------------------------
*/
categoriesRouter.post(
  "/:categoryId/subcategories/:subCategoryId/items",
  asyncHandler(async (request: Request, response: Response) => {
    const { subCategoryId } = request.params;
    const { name } = request.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return response.status(400).json({
        success: false,
        message: "กรุณาระบุชื่อหมวดหมู่ระดับ 3",
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `
      INSERT INTO sub_sub_categories
        (sub_category_id, sub_sub_category_name)
      VALUES (?, ?)
      `,
      [subCategoryId, name.trim()]
    );

    response.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        subCategoryId: Number(subCategoryId),
        name: name.trim(),
      },
    });
  })
);

/*
|--------------------------------------------------------------------------
| PUT
| /api/categories/:categoryId/subcategories/:subCategoryId/items/:subSubId
|
| แก้ไข Level 3
|--------------------------------------------------------------------------
*/
categoriesRouter.put(
  "/:categoryId/subcategories/:subCategoryId/items/:subSubId",
  asyncHandler(async (request: Request, response: Response) => {
    const { subSubId } = request.params;
    const { name } = request.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return response.status(400).json({
        success: false,
        message: "กรุณาระบุชื่อหมวดหมู่ระดับ 3",
      });
    }

    await pool.query(
      `
      UPDATE sub_sub_categories
      SET sub_sub_category_name = ?
      WHERE sub_sub_category_id = ?
      `,
      [name.trim(), subSubId]
    );

    response.json({
      success: true,
      message: "แก้ไขหมวดหมู่ระดับ 3 สำเร็จ",
    });
  })
);

/*
|--------------------------------------------------------------------------
| DELETE
| /api/categories/:categoryId/subcategories/:subCategoryId/items/:subSubId
|
| ลบ Level 3
|--------------------------------------------------------------------------
*/
categoriesRouter.delete(
  "/:categoryId/subcategories/:subCategoryId/items/:subSubId",
  asyncHandler(async (request: Request, response: Response) => {
    const { subSubId } = request.params;

    await pool.query(
      `
      DELETE FROM sub_sub_categories
      WHERE sub_sub_category_id = ?
      `,
      [subSubId]
    );

    response.json({
      success: true,
      message: "ลบหมวดหมู่ระดับ 3 สำเร็จ",
    });
  })
);