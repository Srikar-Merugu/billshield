import { neon } from "@neondatabase/serverless";

let sqlClient: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  sqlClient ??= neon(process.env.DATABASE_URL);
  return sqlClient;
}

export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDeviceId(req: Request): string {
  const id = req.headers.get("x-device-id") ?? "";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) throw new Error("Missing device id");
  return id;
}
