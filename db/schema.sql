-- BillShield schema. Every bill is a row, every line on it is a row. History is a row, not a cell.
-- No names, phone numbers, account numbers or addresses are stored (text is masked before insert).

create extension if not exists pgcrypto;

-- What a person was promised, and when it changed. A changed promise is a new row.
create table if not exists promise (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  company text,
  summary text not null,
  original_text text,
  items jsonb not null default '[]',
  valid_from timestamptz not null default now()
);

create table if not exists bill (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  promise_id uuid references promise(id),
  company text,
  document_type text,
  bill_date date,
  invoice_ref text,
  currency text not null default 'INR',
  printed_total numeric(14,2),
  computed_total numeric(14,2),
  total_matches boolean,
  tax_mode text,
  verdict text not null,
  photo_url text,          -- file lives in blob storage; the row only keeps the link
  promise_photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists bill_device_idx on bill (device_id, created_at desc);

-- Earlier totals printed on the bill itself (e.g. the bar chart on a phone bill).
create table if not exists printed_history (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bill(id) on delete cascade,
  period text not null,
  amount numeric(14,2) not null
);

create table if not exists line_item (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bill(id) on delete cascade,
  position int not null,
  label text not null,
  normalized_label text not null,
  plain_words text,
  amount numeric(14,2) not null,
  kind text not null,
  tax_rate_percent numeric(6,3),
  taxable_base numeric(14,2),
  promise_item_index int,
  promised_amount numeric(14,2),
  difference numeric(14,2) not null default 0,
  status text not null check (status in ('ok','wrong','unexplained','agreed','disputed')),
  user_answer text check (user_answer in ('agreed','disputed'))
);
create index if not exists line_item_label_idx on line_item (normalized_label);

-- THE ONE LINK THAT IS THE PROOF: a message points at the line it disputes.
create table if not exists message (
  id uuid primary key default gen_random_uuid(),
  line_item_id uuid not null references line_item(id) on delete cascade,
  bill_id uuid not null references bill(id) on delete cascade,
  channel text not null check (channel in ('email','chat')),
  suggested_text text not null,
  written_by text not null check (written_by in ('ai','fallback')),
  refund_total numeric(14,2) not null,
  final_text text,
  words_changed int,
  sent_where text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists message_line_idx on message (line_item_id);
