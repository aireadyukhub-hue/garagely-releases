-- ============================================================================
-- GarageDash — Migration 0003
-- When a job is converted to an invoice, carry the job's technician notes
-- into the invoice's notes field.
-- ============================================================================

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

  insert into invoices (garage_id, invoice_number, job_id, customer_id, status,
                        subtotal, vat_rate, vat_amount, total, notes)
  values (g, next_invoice_number(), p_job_id, j.customer_id, 'unpaid',
          sub, v_rate, vat, tot, j.technician_notes)
  returning id into new_id;

  insert into invoice_line_items (garage_id, invoice_id, description, quantity, unit_price, total)
  select g, new_id, description, quantity, unit_price, total
  from job_line_items where job_id = p_job_id and garage_id = g;

  update jobs set status = 'invoiced' where id = p_job_id;
  return query select * from invoices where id = new_id;
end $$;
