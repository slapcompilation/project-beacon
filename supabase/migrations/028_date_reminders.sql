-- Feature: Date Reminders on variants
-- Mirrors Sortly's DateReminder alert type — allows attaching arbitrary scheduled
-- dates to any variant (maintenance due, warranty expiry, inspection, permit renewal…).
-- These are surfaced by the Eye layer and fire notifications ahead of the due date.

alter table product_variants
  add column if not exists reminder_date  date        null,
  add column if not exists reminder_label text        null;  -- e.g. "Annual maintenance due"

comment on column product_variants.reminder_date  is 'Optional scheduled reminder date (maintenance, warranty, inspection, …)';
comment on column product_variants.reminder_label is 'Human label for the reminder, e.g. "Boiler service due"';
