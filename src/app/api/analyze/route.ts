import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { AiRefusedError, extractBill, type FileInput } from "@/lib/ai";
import { loadBill, syncLineStatuses } from "@/lib/bills";
import { getDeviceId, normalizeLabel, sql } from "@/lib/db";
import { maskNullable, maskText } from "@/lib/mask";

export const maxDuration = 300;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 4 * 1024 * 1024;

async function readFile(f: File | null): Promise<(FileInput & { bytes: Buffer }) | null> {
  if (!f || f.size === 0) return null;
  if (!ALLOWED.includes(f.type)) throw new UserError("Please upload a photo (JPG/PNG/WebP) or a PDF.");
  if (f.size > MAX_BYTES) throw new UserError("That file is too big (max 4 MB). Try a screenshot instead.");
  const bytes = Buffer.from(await f.arrayBuffer());
  return { mediaType: f.type, base64: bytes.toString("base64"), bytes };
}

class UserError extends Error {}

async function storeFile(deviceId: string, kind: string, f: { mediaType: string; bytes: Buffer } | null) {
  if (!f || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  const ext = f.mediaType === "application/pdf" ? "pdf" : f.mediaType.split("/")[1];
  const blob = await put(`${kind}/${deviceId}/${crypto.randomUUID()}.${ext}`, f.bytes, {
    access: "private",
    contentType: f.mediaType,
  });
  return blob.url;
}

export async function POST(req: Request) {
  try {
    const deviceId = getDeviceId(req);
    const form = await req.formData();
    const bill = await readFile(form.get("bill") as File | null);
    if (!bill) throw new UserError("Please add a photo or PDF of your bill.");
    const promisePhoto = await readFile(form.get("promisePhoto") as File | null);
    const promiseText = String(form.get("promiseText") ?? "").slice(0, 1000);
    if (!promiseText.trim() && !promisePhoto) {
      throw new UserError("Tell us what you were promised (plan price, offer, interest rate…).");
    }

    const extraction = await extractBill(bill, promiseText, promisePhoto);
    if (!extraction.readable || extraction.lines.length === 0) {
      throw new UserError("We couldn't read that as a bill. Try a clearer, straight photo of the whole bill.");
    }

    const [photoUrl, promisePhotoUrl] = await Promise.all([
      storeFile(deviceId, "bills", bill),
      storeFile(deviceId, "promises", promisePhoto),
    ]);

    const db = sql();
    const company = maskNullable(extraction.company);
    const promiseSummary = maskText(extraction.promise_summary || promiseText || "the promised price");
    const promiseItems = extraction.promise_items.map((p) => ({ label: maskText(p.label), price: p.price }));

    // A promise that changed is a new row (so we can answer "when did it change?").
    const latest = (await db`
      select id, items, summary from promise
      where device_id = ${deviceId} and company is not distinct from ${company}
      order by valid_from desc limit 1`) as { id: string; items: unknown; summary: string }[];
    let promiseId: string;
    if (latest[0] && JSON.stringify(latest[0].items) === JSON.stringify(promiseItems) && latest[0].summary === promiseSummary) {
      promiseId = latest[0].id;
    } else {
      const inserted = (await db`
        insert into promise (device_id, company, summary, original_text, items)
        values (${deviceId}, ${company}, ${promiseSummary}, ${maskText(promiseText)}, ${JSON.stringify(promiseItems)})
        returning id`) as { id: string }[];
      promiseId = inserted[0].id;
    }

    const billDate = /^\d{4}-\d{2}-\d{2}$/.test(extraction.bill_date ?? "") ? extraction.bill_date : null;
    const billRows = (await db`
      insert into bill (device_id, promise_id, company, document_type, bill_date, invoice_ref, currency,
                        printed_total, verdict, photo_url, promise_photo_url)
      values (${deviceId}, ${promiseId}, ${company}, ${maskText(extraction.document_type)}, ${billDate},
              ${maskNullable(extraction.invoice_ref)}, ${extraction.currency || "INR"}, ${extraction.printed_total},
              'pending', ${photoUrl}, ${promisePhotoUrl})
      returning id`) as { id: string }[];
    const billId = billRows[0].id;

    for (const [position, l] of extraction.lines.entries()) {
      const label = maskText(l.label);
      await db`
        insert into line_item (bill_id, position, label, normalized_label, plain_words, amount, kind,
                               tax_rate_percent, taxable_base, promise_item_index, status)
        values (${billId}, ${position}, ${label}, ${normalizeLabel(label)}, ${maskText(l.plain_words)},
                ${l.amount}, ${l.kind}, ${l.tax_rate_percent}, ${l.taxable_base}, ${l.promise_item_index}, 'ok')`;
    }
    for (const h of extraction.earlier_bills) {
      await db`insert into printed_history (bill_id, period, amount) values (${billId}, ${h.period}, ${h.amount})`;
    }

    const view = await loadBill(billId, deviceId);
    if (!view) throw new Error("Saved bill not found");
    await syncLineStatuses(view);
    return NextResponse.json(view);
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  if (err instanceof UserError || err instanceof AiRefusedError) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
