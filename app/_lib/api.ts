const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
};

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? window.sessionStorage.getItem("authToken") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    if (response.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.sessionStorage.removeItem("authToken");
      window.location.assign("/login");
    }
    throw new ApiRequestError(payload?.error ?? "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้", response.status);
  }
  return payload.data;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}
