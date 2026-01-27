-- Add setter_id to booking_sessions
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'booking_sessions' and column_name = 'setter_id') then
    alter table public.booking_sessions add column setter_id uuid references public.users(id);
  end if;
end $$;

-- Update data sync function to include setter
create or replace function public.sync_booking_session_to_lead()
returns trigger
language plpgsql
security definer
as $$
declare
  lead_id uuid;
  metadata_json jsonb;
  coach_name text;
  setter_name text;
begin
  -- Resolve coach name if coach_selected is present
  if new.coach_selected is not null then
    select name into coach_name from public.users where id::text = new.coach_selected::text;
  end if;

  -- Resolve setter name if setter_id is present
  if new.setter_id is not null then
    select name into setter_name from public.users where id = new.setter_id;
  end if;

  -- Construct metadata with journey fields
  metadata_json = jsonb_build_object(
    'utm_source', new.utm_source,
    'utm_medium', new.utm_medium,
    'utm_campaign', new.utm_campaign,
    'landing_page_url', new.landing_page_url,
    'questionnaire', new.questionnaire_responses,
    'questionnaire_completed_at', new.questionnaire_completed_at,
    'current_step', new.current_step,
    'coach_selected', coalesce(coach_name, new.coach_selected),
    'coach_selected_id', new.coach_selected,
    'coach_selection_type', new.coach_selection_type,
    'booking_completed_at', new.booking_completed_at,
    'consultation_scheduled_for', new.consultation_scheduled_for,
    'setter_name', setter_name,
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
      booked_by_user_id = coalesce(new.setter_id, booked_by_user_id), -- Update setter if present
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
      booked_by_user_id,
      metadata
    ) values (
      new.first_name,
      new.last_name,
      new.email,
      new.phone,
      'New',
      'Web Form',
      new.setter_id,
      metadata_json
    );
  end if;

  return new;
exception when others then
  raise warning 'Error syncing booking session to lead: %', SQLERRM;
  return new;
end;
$$;
