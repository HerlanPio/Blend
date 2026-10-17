create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New member' check (char_length(display_name) between 1 and 80),
  age smallint check (age is null or age between 18 and 120),
  occupation text not null default '' check (char_length(occupation) <= 120),
  city text not null default '' check (char_length(city) <= 120),
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text not null default '',
  intent text not null default 'A real connection'
    check (intent in ('A real connection', 'New friends', 'Just exploring')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null check (char_length(caption) between 1 and 500),
  media_url text not null default '',
  location text not null default '' check (char_length(location) <= 120),
  audience text not null default 'public' check (audience in ('public', 'followers', 'private')),
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  created_at timestamptz not null default now()
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 180),
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index posts_created_at_idx on public.posts (created_at desc);
create index posts_author_id_idx on public.posts (author_id);
create index stories_expires_at_idx on public.stories (expires_at);
create index comments_post_created_idx on public.comments (post_id, created_at);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index follows_followee_idx on public.follows (followee_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(left(new.raw_user_meta_data ->> 'display_name', 80), ''), 'New member')
  );
  return new;
end;
$$;

create trigger auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create or replace function public.update_post_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'likes' then
    update public.posts
      set likes_count = greatest(0, likes_count + case when tg_op = 'INSERT' then 1 else -1 end)
      where id = case when tg_op = 'INSERT' then new.post_id else old.post_id end;
  else
    update public.posts
      set comments_count = greatest(0, comments_count + case when tg_op = 'INSERT' then 1 else -1 end)
      where id = case when tg_op = 'INSERT' then new.post_id else old.post_id end;
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  return old;
end;
$$;

create trigger likes_update_post_count
after insert or delete on public.likes
for each row execute function public.update_post_counts();

create trigger comments_update_post_count
after insert or delete on public.comments
for each row execute function public.update_post_counts();

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = target_conversation and profile_id = (select auth.uid())
  );
$$;

create or replace function public.start_conversation(other_profile uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid := auth.uid();
  existing_conversation uuid;
  new_conversation uuid;
begin
  if current_profile is null or other_profile is null or current_profile = other_profile then
    raise exception 'A conversation requires another signed-in member.';
  end if;
  if not exists (select 1 from public.profiles where id = other_profile) then
    raise exception 'Profile not found.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(current_profile::text, other_profile::text) || ':' ||
    greatest(current_profile::text, other_profile::text),
    0
  ));

  select mine.conversation_id into existing_conversation
  from public.conversation_members mine
  join public.conversation_members theirs
    on theirs.conversation_id = mine.conversation_id
  where mine.profile_id = current_profile and theirs.profile_id = other_profile
    and (select count(*) from public.conversation_members members
         where members.conversation_id = mine.conversation_id) = 2
  limit 1;

  if existing_conversation is not null then
    return existing_conversation;
  end if;

  insert into public.conversations default values returning id into new_conversation;
  insert into public.conversation_members (conversation_id, profile_id)
  values (new_conversation, current_profile), (new_conversation, other_profile);
  return new_conversation;
end;
$$;

create or replace function public.send_message(target_conversation uuid, message_content text)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_message public.messages;
begin
  if auth.uid() is null or not public.is_conversation_member(target_conversation) then
    raise exception 'Conversation not found.';
  end if;
  if message_content is null or char_length(trim(message_content)) not between 1 and 2000 then
    raise exception 'Message must be between 1 and 2000 characters.';
  end if;

  insert into public.messages (conversation_id, sender_id, content)
  values (target_conversation, auth.uid(), trim(message_content))
  returning * into inserted_message;
  return inserted_message;
end;
$$;

grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
revoke all on function public.is_conversation_member(uuid) from public, anon;
revoke all on function public.start_conversation(uuid) from public, anon;
revoke all on function public.send_message(uuid, text) from public, anon;

grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.posts to authenticated;
grant select, insert, delete on public.stories to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select, insert, delete on public.likes to authenticated;
grant select, insert, delete on public.bookmarks to authenticated;
grant select, insert, delete on public.comments to authenticated;
grant select on public.conversations, public.conversation_members, public.messages to authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.stories enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.comments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "Authenticated users can view profiles"
on public.profiles for select to authenticated using (true);
create policy "Members can update their own profile"
on public.profiles for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Members can view public and followed posts"
on public.posts for select to authenticated using (
  audience = 'public'
  or author_id = (select auth.uid())
  or (audience = 'followers' and exists (
    select 1 from public.follows
    where follower_id = (select auth.uid()) and followee_id = author_id
  ))
);
create policy "Members can create their own posts"
on public.posts for insert to authenticated
with check (author_id = (select auth.uid()));
create policy "Members can delete their own posts"
on public.posts for delete to authenticated
using (author_id = (select auth.uid()));

create policy "Members can view active stories"
on public.stories for select to authenticated
using (expires_at > now());
create policy "Members can create their own stories"
on public.stories for insert to authenticated
with check (author_id = (select auth.uid()));
create policy "Members can delete their own stories"
on public.stories for delete to authenticated
using (author_id = (select auth.uid()));

create policy "Members can view follows"
on public.follows for select to authenticated using (true);
create policy "Members can follow themselves as follower"
on public.follows for insert to authenticated
with check (follower_id = (select auth.uid()) and follower_id <> followee_id);
create policy "Members can unfollow themselves"
on public.follows for delete to authenticated
using (follower_id = (select auth.uid()));

create policy "Members can view likes"
on public.likes for select to authenticated using (true);
create policy "Members can like as themselves"
on public.likes for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "Members can remove their own likes"
on public.likes for delete to authenticated
using (user_id = (select auth.uid()));

create policy "Members can view their bookmarks"
on public.bookmarks for select to authenticated
using (user_id = (select auth.uid()));
create policy "Members can save posts as themselves"
on public.bookmarks for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "Members can remove their own bookmarks"
on public.bookmarks for delete to authenticated
using (user_id = (select auth.uid()));

create policy "Members can view comments on visible posts"
on public.comments for select to authenticated using (
  exists (select 1 from public.posts where posts.id = comments.post_id)
);
create policy "Members can comment as themselves on visible posts"
on public.comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.posts where posts.id = comments.post_id)
);
create policy "Members can delete their own comments"
on public.comments for delete to authenticated
using (author_id = (select auth.uid()));

create policy "Members can view their conversations"
on public.conversations for select to authenticated
using (public.is_conversation_member(id));
create policy "Members can view conversation participants"
on public.conversation_members for select to authenticated
using (public.is_conversation_member(conversation_id));
create policy "Members can view their messages"
on public.messages for select to authenticated
using (public.is_conversation_member(conversation_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blend-media', 'blend-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can read media they are allowed to see"
on storage.objects for select to authenticated using (
  bucket_id = 'blend-media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.profiles
      where profiles.avatar_url = storage.objects.name
    )
    or exists (
      select 1 from public.posts
      where posts.media_url = storage.objects.name
        and (
          posts.author_id = (select auth.uid())
          or posts.audience = 'public'
          or (posts.audience = 'followers' and exists (
            select 1 from public.follows
            where follower_id = (select auth.uid()) and followee_id = posts.author_id
          ))
        )
    )
    or exists (
      select 1 from public.stories
      where stories.media_url = storage.objects.name and stories.expires_at > now()
    )
  )
);
create policy "Members can upload to their own media folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'blend-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members can delete from their own media folder"
on storage.objects for delete to authenticated
using (bucket_id = 'blend-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
