import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "./api-error";
import { env } from "../config/env";

const maxImageBytes = 2 * 1024 * 1024;
const uploadDirectory = join(process.cwd(), "public", "products", "uploads");

type SavedProductImage = { url: string; publicId: string };

type CloudinaryUploadResponse = {
  secure_url?: unknown;
  public_id?: unknown;
  error?: { message?: unknown };
};

function cloudinaryIsConfigured() {
  return env.imageStorage.provider === "cloudinary"
    && Boolean(env.imageStorage.cloudName && env.imageStorage.apiKey && env.imageStorage.apiSecret);
}

function requireCloudinaryConfiguration() {
  if (!cloudinaryIsConfigured()) {
    throw new ApiError(
      503,
      "ยังไม่ได้ตั้งค่า Cloudinary กรุณากำหนด CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY และ CLOUDINARY_API_SECRET",
    );
  }
}

function cloudinarySignature(parameters: Record<string, string>, apiSecret: string) {
  const parameterString = Object.entries(parameters)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${parameterString}${apiSecret}`).digest("hex");
}

function cloudinaryEndpoint(path: string) {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.imageStorage.cloudName)}/${path}`;
}

async function readCloudinaryResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as CloudinaryUploadResponse;
  if (!response.ok) {
    const message = typeof payload.error?.message === "string" ? payload.error.message : "ไม่ทราบสาเหตุ";
    if (message.toLowerCase().includes("invalid signature")) {
      throw new ApiError(
        502,
        "Cloudinary ตรวจสอบลายเซ็นไม่ผ่าน กรุณาตรวจว่า CLOUDINARY_API_SECRET เป็น Secret ของ API Key ชุดเดียวกับ CLOUDINARY_CLOUD_NAME และ CLOUDINARY_API_KEY",
      );
    }
    throw new ApiError(502, `Cloudinary ตอบกลับข้อผิดพลาด: ${message}`);
  }
  return payload;
}

async function uploadToCloudinary(buffer: Buffer, mimeType: string, extension: string) {
  requireCloudinaryConfiguration();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = `product-${randomUUID()}`;
  const folder = env.imageStorage.folder;
  const signature = cloudinarySignature({ folder, public_id: publicId, timestamp }, env.imageStorage.apiSecret);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), `${publicId}.${extension}`);
  form.append("api_key", env.imageStorage.apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("signature", signature);

  let response: Response;
  try {
    response = await fetch(cloudinaryEndpoint("image/upload"), { method: "POST", body: form });
  } catch {
    throw new ApiError(502, "ไม่สามารถเชื่อมต่อ Cloudinary เพื่ออัปโหลดรูปสินค้า");
  }
  const payload = await readCloudinaryResponse(response);
  if (typeof payload.secure_url !== "string" || typeof payload.public_id !== "string") {
    throw new ApiError(502, "Cloudinary ไม่ได้ส่ง URL รูปสินค้ากลับมา");
  }
  return { url: payload.secure_url, publicId: payload.public_id };
}

export async function saveProductImage(value: unknown): Promise<SavedProductImage | null> {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ApiError(400, "รูปสินค้าต้องเป็นไฟล์รูปภาพที่ถูกต้อง");

  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new ApiError(400, "รองรับเฉพาะรูป PNG, JPG หรือ WEBP");

  const extension = match[1] === "image/jpeg" ? "jpg" : match[1].slice("image/".length);
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > maxImageBytes) {
    throw new ApiError(400, "ขนาดรูปสินค้าต้องไม่เกิน 2 MB");
  }

  return uploadToCloudinary(buffer, match[1], extension);
}

export async function removeProductImage(url: string | null | undefined, publicId?: string | null) {
  if (publicId && cloudinaryIsConfigured()) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = cloudinarySignature({ public_id: publicId, timestamp }, env.imageStorage.apiSecret);
    const form = new URLSearchParams({
      public_id: publicId,
      timestamp,
      api_key: env.imageStorage.apiKey,
      signature,
    });
    try {
      await fetch(cloudinaryEndpoint("image/destroy"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
    } catch {
      // Image cleanup is best-effort after the database transaction is complete.
    }
    return;
  }

  // Keep cleanup for images created by the previous local-storage implementation.
  if (!url?.startsWith("/products/uploads/")) return;
  const fileName = url.slice("/products/uploads/".length);
  if (!/^[a-z0-9-]+\.(?:png|jpg|webp)$/i.test(fileName)) return;
  await unlink(join(uploadDirectory, fileName)).catch(() => undefined);
}
