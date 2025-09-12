-- Create table for video channel subscriptions
create table if not exists public.video_channel_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_title text not null,
  created_at timestamp with time zone not null default now(),
  unique(user_id, channel_title)
);

-- Enable RLS
alter table public.video_channel_subscriptions enable row level security;

-- RLS Policies
create policy "Can read own subscriptions"
  on public.video_channel_subscriptions for select
  using (auth.uid() = user_id);

create policy "Can insert own subscriptions"
  on public.video_channel_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Can delete own subscriptions"
  on public.video_channel_subscriptions for delete
  using (auth.uid() = user_id);
