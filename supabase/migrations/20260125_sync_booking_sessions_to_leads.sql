-- Function to sync booking_sessions to leads
create or replace function public.sync_booking_session_to_lead()
returns trigger
language plpgsql
security definer
as $$
declare
  lead_id uuid;
  metadata_json jsonb;
begin
  -- Construct metadata from extra fields
  metadata_json = jsonb_build_object(
    'utm_source', new.utm_source,
    'utm_medium', new.utm_medium,
    'utm_campaign', new.utm_campaign,
    'landing_page_url', new.landing_page_url,
    'questionnaire', new.questionnaire_responses,
    'questionnaire_completed_at', new.questionnaire_completed_at,
    'source_detail', 'Booking Session Sync'
  );

  -- Check if lead exists by email
  select id into lead_id from public.leads where email = new.email;

  if lead_id is not null then
    -- Update existing lead
    update public.leads
    set
      first_name = coalesce(new.first_name, first_name),
      last_name = coalesce(new.last_name, last_name),
      phone = coalesce(new.phone, phone),
      metadata = metadata || metadata_json, -- Merge metadata
      updated_at = now()
    where id = lead_id;
  else
    -- Insert new lead
    insert into public.leads (
      first_name,
      last_name,
      email,
      phone,
      status,
      source,
      metadata
    ) values (
      new.first_name,
      new.last_name,
      new.email,
      new.phone,
      'New',
      'Web Form', -- or 'Booking Session'
      metadata_json
    );
  end if;

  return new;
exception when others then
  -- Log error but don't fail the booking_session insert/update
  raise warning 'Error syncing booking session to lead: %', SQLERRM;
  return new;
end;
$$;

-- Create Trigger
drop trigger if exists on_booking_session_sync_lead on public.booking_sessions;
create trigger on_booking_session_sync_lead
  after insert or update
  on public.booking_sessions
  for each row
  execute function public.sync_booking_session_to_lead();
