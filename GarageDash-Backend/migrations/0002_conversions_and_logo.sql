-- ============================================================================
-- GarageDash — Migration 0002
--  (1) Quote → Job → Invoice conversion chain, carrying line items + pricing.
--  (2) settings.logo_data for a per-garage custom logo (base64 data URL).
-- Idempotent; apply via Supabase SQL Editor.
-- ============================================================================

-- ── (2) Custom logo column ──────────────────────────────────────────────────
alter table settings add column if not exists logo_data text;

-- ── (1) Conversions ─────────────────────────────────────────────────────────

-- Quote → Job: now also copies the quote's line items into the job.
create or replace function convert_quote_to_job(p_quote_id bigint)
returns setof jobs language plpgsql as $$
declare new_id bigint; g bigint := current_garage_id(); q record;
begin
  select * into q from quotes where id = p_quote_id and garage_id = g;
  insert into jobs (garage_id, job_number, customer_id, vehicle_id, status, title, labour_rate)
  values (g, next_job_number(), q.customer_id, q.vehicle_id, 'booked', q.title, 65)
  returning id into new_id;

  insert into job_line_items (garage_id, job_id, type, description, quantity, unit_price, total, part_id)
  select g, new_id, 'part', description, quantity, unit_price, total, null
  from quote_line_items where quote_id = p_quote_id and garage_id = g;

  update quotes set status = 'converted', converted_job_id = new_id where id = p_quote_id;
  return query select * from jobs where id = new_id;
end $$;

-- Job → Invoice: copies the job's line items, totals from settings VAT rate.
create or replace function convert_job_to_invoice(p_job_id bigint)
returns setof invoices language plpgsql as $$
declare new_id bigint; g bigint := current_garage_id(); j record;
        v_rate real; sub real; vat real; tot real;
begin
  select * into j from jobs where id = p_job_id and garage_id = g;
  select coalesce(vat_rate, 20) into v_rate from settings where garage_id = g;
  select coalesce(sum(total), 0) into sub from job_line_items where job_id = p_job_id and garage_id = g;
  vat := round((sub * v_rate / 100)::numeric, 2);
  tot := round((sub + vat)::numeric, 2);

  insert into invoices (garage_id, invoice_number, job_id, customer_id, status, subtotal, vat_rate, vat_amount, total)
  values (g, next_invoice_number(), p_job_id, j.customer_id, 'unpaid', sub, v_rate, vat, tot)
  returning id into new_id;

  insert into invoice_line_items (garage_id, invoice_id, description, quantity, unit_price, total)
  select g, new_id, description, quantity, unit_price, total
  from job_line_items where job_id = p_job_id and garage_id = g;

  update jobs set status = 'invoiced' where id = p_job_id;
  return query select * from invoices where id = new_id;
end $$;

-- Quote → Invoice (direct, no job sheet): copies quote line items + its totals.
create or replace function convert_quote_to_invoice(p_quote_id bigint)
returns setof invoices language plpgsql as $$
declare new_id bigint; g bigint := current_garage_id(); q record;
begin
  select * into q from quotes where id = p_quote_id and garage_id = g;

  insert into invoices (garage_id, invoice_number, job_id, customer_id, status, subtotal, vat_rate, vat_amount, total)
  values (g, next_invoice_number(), null, q.customer_id, 'unpaid',
          coalesce(q.subtotal, 0), coalesce(q.vat_rate, 20), coalesce(q.vat_amount, 0), coalesce(q.total, 0))
  returning id into new_id;

  insert into invoice_line_items (garage_id, invoice_id, description, quantity, unit_price, total)
  select g, new_id, description, quantity, unit_price, total
  from quote_line_items where quote_id = p_quote_id and garage_id = g;

  update quotes set status = 'converted' where id = p_quote_id;
  return query select * from invoices where id = new_id;
end $$;

grant execute on function convert_quote_to_job, convert_job_to_invoice, convert_quote_to_invoice
  to authenticated;
