SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  role ENUM('owner', 'cashier', 'stock') NOT NULL DEFAULT 'cashier',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_code VARCHAR(50) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NULL,
  credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_due DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_code (customer_code),
  KEY idx_customers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku VARCHAR(80) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  stock_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  low_stock_threshold DECIMAL(12,3) NOT NULL DEFAULT 0,
  image_url VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_category (category_id),
  KEY idx_products_name (name),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(50) NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  employee_id BIGINT UNSIGNED NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  status ENUM('pending', 'paid', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (order_number),
  KEY idx_orders_created_at (created_at),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_employee (employee_id),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_orders_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  product_name VARCHAR(190) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_product (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  method ENUM('cash', 'qr', 'credit') NOT NULL,
  amount_received DECIMAL(12,2) NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL,
  change_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  transaction_reference VARCHAR(190) NULL,
  paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_order (order_id),
  KEY idx_payments_paid_at (paid_at),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  movement_type ENUM('opening', 'purchase', 'sale', 'adjustment', 'return') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_product_created (product_id, created_at),
  KEY idx_inventory_order (order_id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_inventory_order FOREIGN KEY (order_id) REFERENCES orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO categories (name, slug) VALUES
  ('วัตถุดิบ', 'ingredients'),
  ('เครื่องปรุง', 'seasonings'),
  ('บรรจุภัณฑ์', 'packaging')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO products (sku, category_id, name, price, unit, stock_quantity, low_stock_threshold, image_url)
SELECT 'SEA-PLA-RED', id, 'ปลาร้าแม่บุญล้ำ ฝาแดง', 25.00, 'กก.', 80, 15, '/products/fish-sauce-red.png' FROM categories WHERE slug = 'seasonings'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), image_url = VALUES(image_url);

INSERT INTO products (sku, category_id, name, price, unit, stock_quantity, low_stock_threshold, image_url)
SELECT 'SEA-PLA-WHITE', id, 'ปลาร้าแม่บุญล้ำ ฝาขาว', 25.00, 'กก.', 65, 15, '/products/fish-sauce-white.png' FROM categories WHERE slug = 'seasonings'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), image_url = VALUES(image_url);

INSERT INTO products (sku, category_id, name, price, unit, stock_quantity, low_stock_threshold, image_url)
SELECT 'SEA-OYSTER-01', id, 'ซอสหอย ตรานกทะเล', 80.00, 'ขวด', 42, 10, '/products/oyster-sauce.png' FROM categories WHERE slug = 'seasonings'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), image_url = VALUES(image_url);

INSERT INTO products (sku, category_id, name, price, unit, stock_quantity, low_stock_threshold, image_url)
SELECT 'ING-SUGAR-01', id, 'น้ำตาล', 30.00, 'กก.', 120, 20, '/products/sugar.png' FROM categories WHERE slug = 'ingredients'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), image_url = VALUES(image_url);

INSERT INTO products (sku, category_id, name, price, unit, stock_quantity, low_stock_threshold, image_url)
SELECT 'SEA-FISH-01', id, 'น้ำปลา ราชารส', 20.00, 'ขวด', 55, 12, '/products/seasoning.png' FROM categories WHERE slug = 'seasonings'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), image_url = VALUES(image_url);

INSERT INTO products (sku, category_id, name, price, unit, stock_quantity, low_stock_threshold, image_url)
SELECT 'SEA-SOY-01', id, 'เต้าเจี้ยวแดง สูตร 1', 60.00, 'ขวด', 36, 8, '/products/sauce.png' FROM categories WHERE slug = 'seasonings'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), image_url = VALUES(image_url);

INSERT INTO products (sku, category_id, name, price, unit, stock_quantity, low_stock_threshold, image_url)
SELECT 'PKG-VAC-01', id, 'ถุงสุญญากาศ 6x14', 45.00, 'แพ็ก', 25, 5, NULL FROM categories WHERE slug = 'packaging'
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), image_url = VALUES(image_url);

INSERT INTO customers (customer_code, full_name, phone, credit_limit, balance_due) VALUES
  ('CUS-0001', 'คุณพรทิพย์ สุขสำราญ', '081-234-5678', 100000.00, 0),
  ('CUS-0002', 'เฮียเพ้ง ตลาดพลู', '089-987-6543', 150000.00, 12500.00),
  ('CUS-0003', 'น้องพิมพ์ ไก่ทอดหาดใหญ่', '085-555-0123', 50000.00, 0)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), phone = VALUES(phone), credit_limit = VALUES(credit_limit);

INSERT INTO employees (email, password_hash, full_name, role) VALUES
  ('captain@gmail.com', 'scrypt:captain-gai-sod:da6ae01ee6a2fd50283b67c264b4f8f91e42826edf2ed351efe189ee159fdaa9af7b8af5bfa0ad46d3d90f6ec137088985a9fe31f6d04f47989b08ff7354c365', 'กัปตันอูด้ง', 'owner')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role), is_active = TRUE;

INSERT INTO inventory_movements (product_id, movement_type, quantity, note)
SELECT p.id, 'opening', p.stock_quantity, 'ยอดยกมาตอนเริ่มระบบ'
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_movements m WHERE m.product_id = p.id AND m.movement_type = 'opening'
);
