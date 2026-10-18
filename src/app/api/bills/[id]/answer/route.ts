import { NextResponse } from "next/server";
import { loadBill, syncLineStatuses } from "@/lib/bills";
import { getDeviceId, sql } from "@/lib/db";

// The user answers "Did you agree to this charge?" for a line we couldn't match to the promise.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deviceId = getDeviceId(req);
  const body = (await req.json()) as { lineId?: string; answer?: string };
  if (!body.lineId || (body.answer !== "agreed" && body.answer !== "disputed")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await sql()`
    update line_item set user_answer = ${body.answer}
    where id = ${body.lineId} and bill_id in (select id from bill where id = ${id} and device_id = ${deviceId})`;
  const view = await loadBill(id, deviceId);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await syncLineStatuses(view);
  return NextResponse.json(view);
}
