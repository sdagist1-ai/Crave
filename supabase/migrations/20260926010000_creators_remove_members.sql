-- A list's creator can remove other members (members could already leave themselves,
-- and the creator could already delete the whole list).
drop policy if exists "Creators can remove members" on public.group_members;
create policy "Creators can remove members" on public.group_members
  for delete to authenticated
  using (exists (
    select 1 from public.groups g
    where g.id = group_members.group_id and g.created_by = (select auth.uid())
  ));
