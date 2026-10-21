alter table public.profiles
  add column if not exists discoverable boolean not null default true,
  add column if not exists allow_message_requests boolean not null default true,
  add column if not exists default_story_audience text not null default 'public'
    check (default_story_audience in ('public', 'followers', 'private'));

alter table public.stories
  add column if not exists audience text not null default 'public'
    check (audience in ('public', 'followers', 'private'));

drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Members can view discoverable and connected profiles"
on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or discoverable
  or exists (
    select 1 from public.follows
    where follows.follower_id = (select auth.uid())
      and follows.followee_id = profiles.id
  )
);

drop policy if exists "Members can view active stories" on public.stories;
create policy "Members can view stories shared with them"
on public.stories for select to authenticated using (
  expires_at > now()
  and (
    author_id = (select auth.uid())
    or audience = 'public'
    or (audience = 'followers' and exists (
      select 1 from public.follows
      where follows.follower_id = (select auth.uid())
        and follows.followee_id = stories.author_id
    ))
  )
);

drop policy if exists "Members can read media they are allowed to see" on storage.objects;
create policy "Members can read media they are allowed to see"
on storage.objects for select to authenticated using (
  bucket_id = 'blend-media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.profiles
      where profiles.avatar_url = storage.objects.name
        and (
          profiles.id = (select auth.uid())
          or profiles.discoverable
          or exists (
            select 1 from public.follows
            where follows.follower_id = (select auth.uid())
              and follows.followee_id = profiles.id
          )
        )
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
      where stories.media_url = storage.objects.name
        and stories.expires_at > now()
        and (
          stories.author_id = (select auth.uid())
          or stories.audience = 'public'
          or (stories.audience = 'followers' and exists (
            select 1 from public.follows
            where follows.follower_id = (select auth.uid())
              and follows.followee_id = stories.author_id
          ))
        )
    )
  )
);

create table public.member_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_profile_id uuid,
  reported_post_id uuid,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(reported_profile_id, reported_post_id) = 1)
);

create index member_blocks_blocked_idx on public.member_blocks (blocked_id, blocker_id);
create index content_reports_created_at_idx on public.content_reports (created_at desc);

alter table public.member_blocks enable row level security;
alter table public.content_reports enable row level security;
revoke all on public.member_blocks from anon, authenticated;
revoke all on public.content_reports from anon, authenticated;
grant select, delete on public.member_blocks to authenticated;
grant insert on public.content_reports to authenticated;

create policy "Members can view their own blocks"
on public.member_blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy "Members can remove their own blocks"
on public.member_blocks for delete to authenticated using (blocker_id = (select auth.uid()));
create policy "Members can submit reports"
on public.content_reports for insert to authenticated with check (reporter_id = (select auth.uid()));

create or replace function public.is_blocked_between(other_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member_blocks
    where (blocker_id = (select auth.uid()) and blocked_id = other_profile)
       or (blocker_id = other_profile and blocked_id = (select auth.uid()))
  );
$$;

create or replace function public.block_member(other_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or other_profile is null or other_profile = auth.uid() then
    raise exception 'Choose another Blend member to block.';
  end if;
  if not exists (select 1 from public.profiles where id = other_profile) then
    raise exception 'Profile not found.';
  end if;

  insert into public.member_blocks (blocker_id, blocked_id)
  values (auth.uid(), other_profile)
  on conflict do nothing;

  delete from public.follows
  where (follower_id = auth.uid() and followee_id = other_profile)
     or (follower_id = other_profile and followee_id = auth.uid());
end;
$$;

grant execute on function public.is_blocked_between(uuid) to authenticated;
grant execute on function public.block_member(uuid) to authenticated;
revoke all on function public.is_blocked_between(uuid) from public, anon;
revoke all on function public.block_member(uuid) from public, anon;

drop policy if exists "Members can view discoverable and connected profiles" on public.profiles;
create policy "Members can view discoverable and connected profiles"
on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or exists (
    select 1 from public.member_blocks
    where blocker_id = (select auth.uid()) and blocked_id = profiles.id
  )
  or (
    not public.is_blocked_between(id)
    and (
      discoverable
      or exists (
        select 1 from public.follows
        where follows.follower_id = (select auth.uid())
          and follows.followee_id = profiles.id
      )
    )
  )
);

drop policy if exists "Members can view public and followed posts" on public.posts;
create policy "Members can view public and followed posts"
on public.posts for select to authenticated using (
  not public.is_blocked_between(author_id)
  and (
    audience = 'public'
    or author_id = (select auth.uid())
    or (audience = 'followers' and exists (
      select 1 from public.follows
      where follower_id = (select auth.uid()) and followee_id = author_id
    ))
  )
);

drop policy if exists "Members can view stories shared with them" on public.stories;
create policy "Members can view stories shared with them"
on public.stories for select to authenticated using (
  expires_at > now()
  and not public.is_blocked_between(author_id)
  and (
    author_id = (select auth.uid())
    or audience = 'public'
    or (audience = 'followers' and exists (
      select 1 from public.follows
      where follows.follower_id = (select auth.uid())
        and follows.followee_id = stories.author_id
    ))
  )
);

drop policy if exists "Members can view follows" on public.follows;
create policy "Members can view follows"
on public.follows for select to authenticated using (
  not public.is_blocked_between(follower_id)
  and not public.is_blocked_between(followee_id)
);

drop policy if exists "Members can follow themselves as follower" on public.follows;
create policy "Members can follow themselves as follower"
on public.follows for insert to authenticated with check (
  follower_id = (select auth.uid())
  and follower_id <> followee_id
  and not public.is_blocked_between(followee_id)
);

drop policy if exists "Members can view comments on visible posts" on public.comments;
create policy "Members can view comments on visible posts"
on public.comments for select to authenticated using (
  not public.is_blocked_between(author_id)
  and exists (select 1 from public.posts where posts.id = comments.post_id)
);

drop policy if exists "Members can comment as themselves on visible posts" on public.comments;
create policy "Members can comment as themselves on visible posts"
on public.comments for insert to authenticated with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.posts where posts.id = comments.post_id)
);

drop policy if exists "Members can view their conversations" on public.conversations;
drop policy if exists "Members can view conversation participants" on public.conversation_members;
drop policy if exists "Members can view their messages" on public.messages;

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members mine
    where mine.conversation_id = target_conversation
      and mine.profile_id = (select auth.uid())
      and not exists (
        select 1 from public.conversation_members other_member
        where other_member.conversation_id = target_conversation
          and other_member.profile_id <> (select auth.uid())
          and public.is_blocked_between(other_member.profile_id)
      )
  );
$$;

grant execute on function public.is_conversation_member(uuid) to authenticated;
revoke all on function public.is_conversation_member(uuid) from public, anon;

create policy "Members can view their conversations"
on public.conversations for select to authenticated using (public.is_conversation_member(id));
create policy "Members can view conversation participants"
on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "Members can view their messages"
on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists "Members can read media they are allowed to see" on storage.objects;
create policy "Members can read media they are allowed to see"
on storage.objects for select to authenticated using (
  bucket_id = 'blend-media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.profiles
      where profiles.avatar_url = storage.objects.name
        and not public.is_blocked_between(profiles.id)
        and (
          profiles.id = (select auth.uid())
          or profiles.discoverable
          or exists (
            select 1 from public.follows
            where follows.follower_id = (select auth.uid())
              and follows.followee_id = profiles.id
          )
        )
    )
    or exists (
      select 1 from public.posts
      where posts.media_url = storage.objects.name
        and not public.is_blocked_between(posts.author_id)
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
      where stories.media_url = storage.objects.name
        and stories.expires_at > now()
        and not public.is_blocked_between(stories.author_id)
        and (
          stories.author_id = (select auth.uid())
          or stories.audience = 'public'
          or (stories.audience = 'followers' and exists (
            select 1 from public.follows
            where follows.follower_id = (select auth.uid())
              and follows.followee_id = stories.author_id
          ))
        )
    )
  )
);

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
  accepts_requests boolean;
begin
  if current_profile is null or other_profile is null or current_profile = other_profile then
    raise exception 'A conversation requires another signed-in member.';
  end if;
  if public.is_blocked_between(other_profile) then
    raise exception 'You cannot start a conversation with this member.';
  end if;

  select profiles.allow_message_requests into accepts_requests
  from public.profiles
  where profiles.id = other_profile;

  if not found then
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

  if not accepts_requests then
    raise exception 'This member is not accepting new message requests.';
  end if;

  insert into public.conversations default values returning id into new_conversation;
  insert into public.conversation_members (conversation_id, profile_id)
  values (new_conversation, current_profile), (new_conversation, other_profile);
  return new_conversation;
end;
$$;
