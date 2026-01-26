create policy "Enable insert access for anon users"
on "public"."leads"
as permissive
for insert
to anon
with check (true);
