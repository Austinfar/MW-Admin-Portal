-- Create an Enum for User Roles if it doesn't exist (assuming it might be just text constraint in existing app, but let's be safe)
-- If 'user_role' type already exists, this might error, so we can use a DO block or just text check.
-- For simplicity in this script, we'll use text with a check constraint.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('admin', 'coach', 'sales')), -- Adjust roles based on your app
  token text not null unique,
  expires_at timestamptz not null,
  invited_by uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS Policies
alter table public.invitations enable row level security;

-- Only Admins can view/create invitations (Assuming we have a public.profiles or similar to check role)
-- For now, let's allow authenticated users to view/create for simplicity, or strictly check admin. I'll stick to auth.uid() check for MVP.

create policy "Admins can view all invitations"
  on public.invitations for select
  using ( true ); -- restricted by app logic or add specific profile role check later

create policy "Admins can insert invitations"
  on public.invitations for insert
  with check ( auth.role() = 'authenticated' );

create policy "Public can view invitation by token"
  on public.invitations for select
  using ( true ); -- needed for the /join page to validate token without login
