import { NextResponse } from "next/server";
import { getDeviceId, sql } from "@/lib/db";

export async function GET(req: Request) {
  const deviceId = getDeviceId(req);
  const rows = await sql()`
    select b.id, b.company, b.document_type, b.bill_date, b.currency, b.verdict, b.created_at,
           p.summary as promise, p.valid_from as promise_from,
           m.id as message_id, m.sent_at, m.words_changed, m.refund_total, m.sent_where,
           l.label as disputed_line
    from bill b
    left join promise p on p.id = b.promise_id
    left join lateral (select * from message where bill_id = b.id order by created_at desc limit 1) m on true
    left join line_item l on l.id = m.line_item_id
    where b.device_id = ${deviceId}
    order by b.created_at desc limit 50`;
  return NextResponse.json(rows);
}
