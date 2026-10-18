// The "AI decides" side of BillShield: reading the photo into lines, plain words, and the
// message wording. The AI never does arithmetic here; check.ts does all of that.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { checkTemplate, PLACEHOLDERS } from "./message";

const MODEL = "claude-opus-5-5";
const BETAS = ["server-side-fallback-2026-07-01"];

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export class AiRefusedError extends Error {}

// ---------- 1. Reading the bill ----------

const LineSchema = z.object({
  label: z.string().describe("The line's text as printed, shortened if very long. Never include personal details."),
  plain_words: z.string().describe("One short sentence in simple English explaining what this charge is."),
  amount: z.number().describe("The amount exactly as printed on this line. Discounts as positive numbers."),
  kind: z.enum(["charge", "discount", "tax", "payment", "other"]),
  tax_rate_percent: z
    .number()
    .nullable()
    .describe("For tax lines only: the printed rate of THIS line (CGST and SGST are each half of the GST rate)."),
  taxable_base: z.number().nullable().describe("For tax lines only: the taxable amount printed next to it, if shown."),
  promise_item_index: z
    .number()
    .nullable()
    .describe("Index into promise_items of the promised item this line corresponds to, or null if none."),
});

const ExtractionSchema = z.object({
  readable: z.boolean().describe("False if this is not a bill/receipt/statement or is too blurry to read."),
  company: z.string().nullable(),
  document_type: z.string().describe("e.g. phone bill, store receipt, credit card statement, EMI statement"),
  bill_date: z.string().nullable().describe("YYYY-MM-DD"),
  invoice_ref: z.string().nullable().describe("Invoice or bill number only. Never an account, card or phone number."),
  currency: z.string().describe("ISO code, e.g. INR, THB"),
  printed_total: z
    .number()
    .nullable()
    .describe("The total of this bill's charges as printed (grand total / total new charges), not including previous dues."),
  lines: z.array(LineSchema).describe("Every line that makes up this bill's charges, in printed order."),
  earlier_bills: z
    .array(z.object({ period: z.string(), amount: z.number() }))
    .describe("Earlier bill totals if the bill prints a history (e.g. a bar chart). Empty if none."),
  promise_items: z
    .array(z.object({ label: z.string(), price: z.number() }))
    .describe("What the customer says they were promised, as items with the amount that should appear on the matching bill line."),
  promise_summary: z.string().describe("The promise in one short phrase, e.g. 'Smart 499 plan' or 'offer price on the box'."),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export interface FileInput {
  mediaType: string;
  base64: string;
}

const EXTRACT_SYSTEM = `You read bills, receipts and statements for BillShield, an app that helps people dispute wrong charges.

Your job is reading, not judging and not arithmetic:
- Copy every amount exactly as printed. Never compute, round, or correct a number.
- List every line that makes up this bill's own charges: plan/package fees, add-on packs, item prices, fees, discounts, and each tax line. Skip previous-balance and payment rows unless they are part of the total.
- For GST receipts, list CGST and SGST as separate tax lines with their own printed rate (each is half the GST slab) and the taxable value printed for them.
- Never output names, addresses, emails, phone numbers, account, card or loan numbers anywhere.
- promise_items: turn the customer's promise (text and/or the promise photo) into items with the price that should appear on the matching bill line. If the promise is a price that includes tax and the bill shows prices including tax, keep it as written.
- promise_item_index: link a bill line to a promise item only when it is clearly the same thing. Leave null when unsure.
- plain_words: explain each line so a 12-year-old understands it.`;

export async function extractBill(
  bill: FileInput,
  promiseText: string,
  promisePhoto: FileInput | null,
): Promise<Extraction> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    fileBlock(bill),
    { type: "text", text: "Above: the customer's bill." },
  ];
  if (promisePhoto) {
    content.push(fileBlock(promisePhoto), { type: "text", text: "Above: a photo of what they were promised." });
  }
  content.push({
    type: "text",
    text: `What the customer says they were promised:\n<promise>\n${promiseText || "(not given)"}\n</promise>`,
  });

  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: "default",
    system: EXTRACT_SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(ExtractionSchema) },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new AiRefusedError("The AI declined to read this file.");
  if (!response.parsed_output) throw new Error("Could not read the bill. Try a clearer photo.");
  return response.parsed_output;
}

function fileBlock(f: FileInput): Anthropic.Beta.BetaContentBlockParam {
  if (f.mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: f.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      data: f.base64,
    },
  };
}

// ---------- 2. Writing the message ----------

const TemplateSchema = z.object({ template: z.string() });

const MESSAGE_SYSTEM = `You write short complaint messages that customers send to a company about a wrong charge.

Rules:
- Use placeholders for every fact: ${PLACEHOLDERS.map((p) => `{{${p}}}`).join(", ")}.
- Never type a digit or a currency symbol yourself. All numbers come from placeholders.
- Polite, firm, specific. Say what was promised, what was charged, and ask for the refund of {{REFUND_TOTAL}}.
- Mention the attached bill/photo. End with {{USER_NAME}}.
- Email: start with a "Subject:" line, then a formal message under 120 words.
- Chat: under 70 words, no subject line.
- If TAX_ON_DIFFERENCE is "none", don't mention tax.`;

export async function writeMessageTemplate(
  channel: "email" | "chat",
  context: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: BETAS,
      fallbacks: "default",
      system: MESSAGE_SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(TemplateSchema) },
      messages: [
        {
          role: "user",
          content: `Channel: ${channel}\nSituation (for wording only, do not copy numbers):\n${context}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return null;
    const template = response.parsed_output?.template;
    if (template && checkTemplate(template).ok) return template;
  }
  return null; // caller falls back to the deterministic template
}
