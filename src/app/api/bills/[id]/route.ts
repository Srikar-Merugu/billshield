import { NextResponse } from "next/server";
import { loadBill } from "@/lib/bills";
import { getDeviceId } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const view = await loadBill(id, getDeviceId(req));
    if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(view);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
