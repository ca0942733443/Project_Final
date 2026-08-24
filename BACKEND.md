# Backend + MySQL

Backend ใช้ Node.js, Express และ MySQL แยกจาก Next.js Frontend โดยค่าเริ่มต้น API ทำงานที่ `http://localhost:4000` และ Frontend ทำงานที่ `http://localhost:3000`.

## เริ่มต้นใช้งาน

1. ติดตั้งและเปิด MySQL 8 ขึ้นไป
2. คัดลอก `.env.example` เป็น `.env` แล้วแก้ `DB_USER` และ `DB_PASSWORD`
3. ตั้งค่า Cloudinary ใน `.env` ด้วย `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` และ `CLOUDINARY_FOLDER` เพื่อให้ระบบอัปโหลดรูปสินค้าไปเก็บบน Cloudinary
4. สร้างฐานข้อมูลและตารางตาม schema ที่ export จาก MySQL Workbench (`products`, `product_units`, `product_batches`, `sales`, `sale_items`, `sale_payments`):

   ```powershell
   npm.cmd run db:init
   ```

5. เปิด Backend:

   ```powershell
   npm.cmd run dev:server
   ```

6. เปิด Frontend ใน PowerShell อีกหน้าต่าง:

   ```powershell
   npm.cmd run dev
   ```

## API ที่เตรียมไว้

- `GET /api/health` ตรวจการเชื่อมต่อ MySQL
- `POST /api/auth/login` ตรวจอีเมล/รหัสผ่านจาก `users.username` และ `users.password_hash`, อ่านบทบาทจาก `roles`, รับเฉพาะบัญชีสถานะ `ACTIVE`, บันทึก `last_login_at` และออก Bearer token อายุ 8 ชั่วโมง
- `GET /api/dashboard?period=day|week|month` อ่าน KPI, กราฟ, สินค้าขายดี และสถานะสต็อก
- `GET /api/categories` อ่านหมวดหมู่พร้อมจำนวนสินค้า
- `GET /api/products` อ่านรายการสินค้า รองรับ `search` และ `category`
- `GET /api/products/:id` อ่านสินค้ารายการเดียว
- `POST /api/products` เพิ่มสินค้า รองรับ `supplierId`, `imageData` (data URL ของ PNG/JPG/WEBP ไม่เกิน 2 MB ซึ่ง Backend จะอัปโหลดไป Cloudinary) และสต็อกตั้งต้น
- `PATCH /api/products/:id` แก้ไขสินค้า Supplier รูปภาพ ราคา หน่วย และยอดสต็อก
- `DELETE /api/products/:id` ปิดใช้งานสินค้าแบบ soft delete
- `GET /api/suppliers` อ่านรายการผู้จำหน่าย
- `POST /api/suppliers` เพิ่มผู้จำหน่ายลงตาราง `suppliers`
- `GET /api/inventory` อ่านสินค้าและสรุปมูลค่า/สต็อกต่ำ/สินค้าหมด
- `GET /api/inventory/movements` อ่านประวัติการเคลื่อนไหวสต็อก
- `POST /api/inventory/movements` รับเข้า คืน หรือปรับยอดสต็อกด้วย transaction รองรับ `supplierId` และ `unitCost` สำหรับการเติมสต็อก
- `GET /api/customers` และ `GET /api/customers/stats` อ่านลูกค้าและสถิติ
- `POST/PATCH/DELETE /api/customers/:id` เพิ่ม แก้ไข และปิดใช้งานลูกค้า (`POST` ใช้ `/api/customers`)
- `GET /api/employees` และ `GET /api/employees/stats` อ่านพนักงานและสถิติ
- `POST/PATCH/DELETE /api/employees/:id` เพิ่ม แก้ไข และปิดใช้งานพนักงาน (`POST` ใช้ `/api/employees`)
- `GET /api/orders` อ่านประวัติการขาย รองรับ `dateFrom`, `dateTo`, `paymentMethod` และ `limit`
- `POST /api/orders` สร้างรายการขาย หักสต็อก และบันทึกการชำระเงินด้วย transaction
- `GET /api/orders/:orderNumber` อ่านรายละเอียดรายการขาย

รูปสินค้าไม่เก็บเป็นไฟล์หรือข้อมูลไบนารีใน MySQL ตาราง `products` เก็บเฉพาะ `image_url` และ `image_public_id` เพื่อแสดงผลและลบรูปบน Cloudinary เมื่อเปลี่ยนรูป โดย `db:init` จะเพิ่มคอลัมน์เหล่านี้ให้ฐานข้อมูลเดิมอัตโนมัติ

ตัวอย่างสร้างรายการขาย:

```json
{
  "paymentMethod": "cash",
  "amountReceived": 500,
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 3, "quantity": 1 }
  ]
}
```

Frontend ที่เชื่อม API แล้ว ได้แก่ Login, Dashboard, POS, คลังสินค้า, คำแนะนำการสั่งซื้อ, ประวัติการขาย, ลูกค้า, พนักงาน และการแจ้งเตือน หาก Backend หรือ MySQL ยังไม่ทำงาน หน้าเหล่านี้จะแสดงข้อความการเชื่อมต่อแทนข้อมูลจำลอง ส่วนหน้าตั้งค่ายังคงเก็บสถานะเฉพาะใน Frontend เพราะ ER ปัจจุบันไม่มีตารางการตั้งค่า

หลังรัน `db:init` ระบบจะสร้าง role/หมวดหมู่เริ่มต้น และสามารถทดลองเข้าสู่ระบบด้วย `captain@gmail.com` / `captain123` ได้ ควรเปลี่ยนรหัสผ่านและค่า `AUTH_SECRET` ก่อนนำขึ้น production ทุก endpoint ยกเว้น health check และ login ต้องส่ง `Authorization: Bearer <token>`

## การตรวจสอบก่อนใช้งาน

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run build:server
npm.cmd run test:routes
```

`test:routes` จะเปิด API บนพอร์ตชั่วคราว ทดสอบ Route อ่าน/เขียนกับตาราง MySQL จริง แล้วล้างข้อมูลทดสอบออกโดยอัตโนมัติ

การทดสอบการเชื่อมต่อหลังเปิด Backend:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```
