-- Product seed generated from the previous captain_kai_sod_db product query.
-- Run database/pro.corrected.sql first.
-- This seed is idempotent by product_id/SKU and product unit.

USE `captain_kai_sod_db`;
START TRANSACTION;

INSERT INTO categories (category_name) VALUES
  ('วัตถุดิบ'),
  ('เครื่องปรุง'),
  ('บรรจุภัณฑ์')
ON DUPLICATE KEY UPDATE category_name = VALUES(category_name);

INSERT INTO suppliers (supplier_name)
SELECT 'เจ๊นิด'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'เจ๊นิด');

INSERT INTO suppliers (supplier_name)
SELECT 'ผู้จำหน่ายทั่วไป'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'ผู้จำหน่ายทั่วไป');

CREATE TEMPORARY TABLE seed_product_data (
  product_id INT UNSIGNED NOT NULL,
  sku VARCHAR(50) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  supplier_name VARCHAR(200) NOT NULL,
  base_unit VARCHAR(30) NOT NULL,
  selling_price DECIMAL(12,2) NOT NULL,
  stock_quantity DECIMAL(14,3) NOT NULL,
  reorder_point DECIMAL(14,3) NOT NULL,
  image_url VARCHAR(500) NULL,
  image_public_id VARCHAR(255) NULL,
  PRIMARY KEY (product_id),
  UNIQUE KEY uq_seed_product_sku (sku)
);

INSERT INTO seed_product_data VALUES
(20, 'OYS-001', 'ซอสหอยตรานกทะเลใหญ่', 'เครื่องปรุง', 'เจ๊นิด', 'ชิ้น', 80.00, 12.000, 4.000, 'https://res.cloudinary.com/bn9qooad/image/upload/v1787709145/products/product-9b0af129-29bb-45cf-a7b9-f1d205691bb9.webp', 'products/product-9b0af129-29bb-45cf-a7b9-f1d205691bb9'),
(21, 'SCE-001', 'ภูเขาทองฝาเขียว600มล.', 'เครื่องปรุง', 'เจ๊นิด', 'ขวด', 35.00, 36.000, 6.000, 'https://res.cloudinary.com/bn9qooad/image/upload/v1787709454/products/product-70efa40d-f9bb-4351-936f-81c4ddb8855b.webp', 'products/product-70efa40d-f9bb-4351-936f-81c4ddb8855b'),
(22, 'BAG-001', 'ถุงหนาขุ่นดาวปีกส้ม', 'บรรจุภัณฑ์', 'ผู้จำหน่ายทั่วไป', 'แพ็ค', 40.00, 40.000, 5.000, 'https://res.cloudinary.com/bn9qooad/image/upload/v1787709683/products/product-4b1d8d16-3ee0-4315-8593-d9d855fc8610.jpg', 'products/product-4b1d8d16-3ee0-4315-8593-d9d855fc8610'),
(23, 'BAG-002', 'ถุงเหนียวใสLLดาวเขียว6*14', 'บรรจุภัณฑ์', 'ผู้จำหน่ายทั่วไป', 'แพ็ค', 45.00, 40.000, 5.000, 'https://res.cloudinary.com/bn9qooad/image/upload/v1787709925/products/product-ef57fa2e-cc5f-4355-b59a-39b302f1e43f.webp', 'products/product-ef57fa2e-cc5f-4355-b59a-39b302f1e43f'),
(24, 'CHK-001', 'ปีกบน', 'วัตถุดิบ', 'ผู้จำหน่ายทั่วไป', 'โล', 85.00, 47.000, 20.000, 'https://res.cloudinary.com/bn9qooad/image/upload/v1787710130/products/product-91c85c4b-95d5-4cfe-9547-de00adba5880.jpg', 'products/product-91c85c4b-95d5-4cfe-9547-de00adba5880'),
(33, 'SLT-001', 'เกลือตรามะลิ', 'วัตถุดิบ', 'ผู้จำหน่ายทั่วไป', 'แพ็ค', 8.00, 60.000, 10.000, 'https://res.cloudinary.com/bn9qooad/image/upload/v1789060543/products/product-38ffbe3a-6732-4e9e-8182-650469748af8.png', 'products/product-38ffbe3a-6732-4e9e-8182-650469748af8');

INSERT INTO products (
  product_id, category_id, supplier_id, sku, product_name, base_unit,
  reorder_point, image_url, image_public_id, is_active
)
SELECT
  d.product_id,
  (SELECT category_id FROM categories WHERE category_name = d.category_name LIMIT 1),
  (SELECT supplier_id FROM suppliers WHERE supplier_name = d.supplier_name ORDER BY supplier_id LIMIT 1),
  d.sku, d.product_name, d.base_unit, d.reorder_point, d.image_url, d.image_public_id, 1
FROM seed_product_data d
ON DUPLICATE KEY UPDATE
  category_id = VALUES(category_id),
  supplier_id = VALUES(supplier_id),
  product_name = VALUES(product_name),
  base_unit = VALUES(base_unit),
  reorder_point = VALUES(reorder_point),
  image_url = VALUES(image_url),
  image_public_id = VALUES(image_public_id),
  is_active = 1;

INSERT INTO product_units (product_id, unit_name, conversion_factor, selling_price, is_default, is_active)
SELECT p.product_id, d.base_unit, 1, d.selling_price, 1, 1
FROM seed_product_data d
INNER JOIN products p ON p.sku = d.sku
ON DUPLICATE KEY UPDATE
  conversion_factor = VALUES(conversion_factor),
  selling_price = VALUES(selling_price),
  is_default = 1,
  is_active = 1;

-- Seed stock batches when a user exists (run npm run db:init first on a fresh database).
SET @seed_user_id = (SELECT user_id FROM users ORDER BY user_id LIMIT 1);
SET @seed_supplier_id = (SELECT supplier_id FROM suppliers WHERE supplier_name = 'ผู้จำหน่ายทั่วไป' ORDER BY supplier_id LIMIT 1);

INSERT INTO goods_receipts (supplier_id, received_by, receipt_no, received_at, status)
SELECT @seed_supplier_id, @seed_user_id, 'SEED-PRODUCTS-001', CURRENT_TIMESTAMP, 'CONFIRMED'
FROM DUAL
WHERE @seed_user_id IS NOT NULL AND @seed_supplier_id IS NOT NULL
ON DUPLICATE KEY UPDATE receipt_id = LAST_INSERT_ID(receipt_id);

SET @seed_receipt_id = (SELECT receipt_id FROM goods_receipts WHERE receipt_no = 'SEED-PRODUCTS-001' LIMIT 1);

INSERT INTO goods_receipt_items (receipt_id, product_id, quantity_base, unit_cost)
SELECT @seed_receipt_id, p.product_id, d.stock_quantity, d.selling_price
FROM seed_product_data d
INNER JOIN products p ON p.sku = d.sku
WHERE @seed_receipt_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM goods_receipt_items gri
    WHERE gri.receipt_id = @seed_receipt_id AND gri.product_id = p.product_id
  );

INSERT INTO product_batches (
  receipt_item_id, product_id, lot_no, received_date, expiry_date,
  quantity_received_base, quantity_remaining_base, status
)
SELECT
  gri.receipt_item_id, p.product_id, CONCAT('SEED-', d.sku), CURRENT_DATE, NULL,
  d.stock_quantity, d.stock_quantity, 'ACTIVE'
FROM seed_product_data d
INNER JOIN products p ON p.sku = d.sku
INNER JOIN goods_receipt_items gri
  ON gri.receipt_id = @seed_receipt_id AND gri.product_id = p.product_id
WHERE @seed_receipt_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  quantity_received_base = VALUES(quantity_received_base),
  quantity_remaining_base = VALUES(quantity_remaining_base),
  status = 'ACTIVE';

DROP TEMPORARY TABLE seed_product_data;
COMMIT;
