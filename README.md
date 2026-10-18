# BillShield

Turn a bill you don't trust into one message worth sending.

Upload a bill (photo or PDF) and say what you were promised. BillShield reads every line,
checks the maths against the promise, points at the line that doesn't add up and writes one
message you can send to the company. If every line checks out, it says so, with the maths.

Built for the 100x Engineers C8 Module 2 hackathon (BillShield brief).

## Where the line is drawn

| Code decides (same input, same answer) | AI decides (judgment) |
|---|---|
| Totals, tax per line (`base × printed rate`), tax added on top vs inside prices | Reading the photo/PDF into lines |
| Charged vs promised, difference, tax on the difference, refund | Each line in plain words |
| "Seen on earlier bills" and "promise changed" from stored rows | Matching a bill line to a promise item |
| Masking emails / phone / account numbers before saving | The message wording |
| Counting words changed before sending | |

**No-go: the AI never states an amount code didn't compute.** The AI writes the message with
placeholders like `{{REFUND_TOTAL}}` and is not allowed to type digits. `src/lib/message.ts`
rejects any template containing a number or currency symbol and code fills in every amount.
If the AI fails twice, a deterministic template is used.

**Wrong vs unexplained:** a line matched to a promise item with a different amount is *wrong*.
A charge that isn't in the promise is *unexplained*: the app asks "Did you agree to this?"
and only a "No, never" turns it into a disputed charge. The app never invents an error.

## Data

`db/schema.sql`: `promise` (history of what was promised, new row when it changes),
`bill`, `line_item`, `printed_history`, and `message`, where **`message.line_item_id → line_item`**
records which line the message disputes, when it was sent and how many words were changed.
Bill photos go to private blob storage and the row keeps only the link. No names, phone numbers,
account numbers or addresses are stored.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run db:migrate
npm run dev
```

```bash
npm test   # maths checker against the hand-checked golden pairs
```

`test-data/test-bill-01.*` is a **synthetic** bill from a fictional company, used only to test
the app. It is not user evidence.

## Stack

Next.js (App Router) on Vercel, Neon Postgres, Vercel Blob (private), Claude (`claude-opus-5-5`)
via the Anthropic SDK with structured outputs.
