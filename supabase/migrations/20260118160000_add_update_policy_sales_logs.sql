-- Add UPDATE policy for sales_call_logs
create policy "Allow authenticated users to update logs"
on sales_call_logs for update
to authenticated
using (true)
with check (true);
