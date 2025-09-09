-- Enable UUID extension
create extension if not exists "uuid-ossp" with schema extensions;

-- Videos table
create table public.videos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  youtube_id text not null,
  title text not null,
  channel_title text not null,
  duration_seconds integer not null,
  thumbnail_url text not null,
  tags text[],
  watch_seconds integer default 0,
  last_watched_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_user_youtube_id unique (user_id, youtube_id)
);

-- Watch sessions table
create table public.watch_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  video_id uuid references public.videos(id) on delete cascade not null,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone,
  seconds_watched integer not null default 0,
  avg_playback_rate real not null default 1.0,
  source text not null default 'web',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User stats table
create table public.user_stats (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  total_seconds bigint not null default 0,
  weekly_goal_seconds integer not null default 18000, -- 5 hours
  last_watched_at timestamp with time zone,
  streak_days integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint user_stats_user_id_key unique (user_id)
);

-- Function to update video watch stats
drop function if exists update_video_watch_stats();
create or replace function update_video_watch_stats()
returns trigger as $$
begin
  -- Update video's watch time and last watched timestamp
  update public.videos
  set 
    watch_seconds = watch_seconds + NEW.seconds_watched,
    last_watched_at = NEW.ended_at,
    updated_at = now()
  where id = NEW.video_id;

  -- Update user's total watch time
  update public.user_stats
  set 
    total_seconds = total_seconds + NEW.seconds_watched,
    last_watched_at = NEW.ended_at,
    updated_at = now()
  where user_id = NEW.user_id;

  return NEW;
end;
$$ language plpgsql security definer;

-- Trigger to update stats after watch session ends
create or replace trigger after_watch_session_ended
after update of ended_at on public.watch_sessions
for each row
when (NEW.ended_at is not null and OLD.ended_at is null)
execute function update_video_watch_stats();

-- Function to get weekly watch time
drop function if exists get_weekly_watch_time(uuid);
create or replace function get_weekly_watch_time(user_id_param uuid)
returns table (date date, seconds bigint) as $$
begin
  return query
  select 
    date_trunc('day', ws.started_at) as date,
    sum(ws.seconds_watched) as seconds
  from 
    public.watch_sessions ws
  where 
    ws.user_id = user_id_param
    and ws.started_at >= date_trunc('week', now())
  group by 
    date_trunc('day', ws.started_at)
  order by 
    date;
end;
$$ language plpgsql security definer;

-- Function to get video watch time
drop function if exists get_video_watch_time(uuid, uuid);
create or replace function get_video_watch_time(
  video_id_param uuid,
  user_id_param uuid
) returns bigint as $$
declare
  total_seconds bigint;
begin
  select coalesce(sum(seconds_watched), 0) into total_seconds
  from public.watch_sessions
  where video_id = video_id_param
  and user_id = user_id_param;
  
  return total_seconds;
end;
$$ language plpgsql security definer;

-- Function to increment user watch time
drop function if exists increment_user_watch_time(uuid, integer);
create or replace function increment_user_watch_time(
  user_id_param uuid,
  seconds integer
) returns void as $$
begin
  update public.user_stats
  set 
    total_seconds = total_seconds + seconds,
    last_watched_at = now(),
    updated_at = now()
  where user_id = user_id_param;
end;
$$ language plpgsql security definer;

-- Row Level Security
-- Enable RLS on all tables
alter table public.videos enable row level security;
alter table public.watch_sessions enable row level security;
alter table public.user_stats enable row level security;

-- Policies for videos
create policy "Users can view their own videos"
on public.videos for select
using (auth.uid() = user_id);

create policy "Users can insert their own videos"
on public.videos for insert
with check (auth.uid() = user_id);

create policy "Users can update their own videos"
on public.videos for update
using (auth.uid() = user_id);

create policy "Users can delete their own videos"
on public.videos for delete
using (auth.uid() = user_id);

-- Policies for watch_sessions
create policy "Users can view their own watch sessions"
on public.watch_sessions for select
using (auth.uid() = user_id);

create policy "Users can insert their own watch sessions"
on public.watch_sessions for insert
with check (auth.uid() = user_id);

create policy "Users can update their own watch sessions"
on public.watch_sessions for update
using (auth.uid() = user_id);

create policy "Users can delete their own watch sessions"
on public.watch_sessions for delete
using (auth.uid() = user_id);

-- Policies for user_stats
create policy "Users can view their own stats"
on public.user_stats for select
using (auth.uid() = user_id);

create policy "Users can insert their own stats"
on public.user_stats for insert
with check (auth.uid() = user_id);

create policy "Users can update their own stats"
on public.user_stats for update
using (auth.uid() = user_id);

-- Create a trigger to create user stats when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_stats (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Set up storage for video thumbnails
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Set up storage policies for thumbnails
create policy "Public Access"
on storage.objects for select
using (bucket_id = 'thumbnails');

create policy "Users can upload their own thumbnails"
on storage.objects for insert
with check (
  bucket_id = 'thumbnails' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own thumbnails"
on storage.objects for update
using (
  bucket_id = 'thumbnails' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own thumbnails"
on storage.objects for delete
using (
  bucket_id = 'thumbnails' 
  and (storage.foldername(name))[1] = auth.uid()::text
);
