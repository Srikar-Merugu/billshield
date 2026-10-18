import { NextResponse } from "next/server";
import { getDeviceId, sql } from "@/lib/db";
import { maskText } from "@/lib/mask";
import { wordsChanged } from "@/lib/words";

// Marks a message as sent and counts the words the person changed before sending it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deviceId = getDeviceId(req);
  const body = (await req.json()) as { finalText?: string; sentWhere?: string };
  const finalText = (body.finalText ?? "").slice(0, 5000);
  const sentWhere = (body.sentWhere ?? "").slice(0, 40) || "not said";
  if (!finalText.trim()) return NextResponse.json({ error: "Message is empty" }, { status: 400 });

  const db = sql();
  const rows = (await db`
    select m.suggested_text from message m join bill b on b.id = m.bill_id
    where m.id = ${id} and b.device_id = ${deviceId}`) as { suggested_text: string }[];
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const changed = wordsChanged(rows[0].suggested_text, finalText);
  await db`
    update message set final_text = ${maskText(finalText)}, words_changed = ${changed},
      sent_where = ${sentWhere}, sent_at = now()
    where id = ${id}`;
  return NextResponse.json({ wordsChanged: changed });
}
