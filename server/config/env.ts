import "dotenv/config";

function readInteger(name: string, fallback: number) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? "development",
  apiPort: readInteger("API_PORT", 4000),
  authSecret: process.env.AUTH_SECRET ?? "development-only-change-this-secret",
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: readInteger("DB_PORT", 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    name: process.env.DB_NAME ?? "captain_kai_sod_db",
    connectionLimit: readInteger("DB_CONNECTION_LIMIT", 10),
  },
});
