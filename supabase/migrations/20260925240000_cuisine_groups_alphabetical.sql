-- Cuisine groups in alphabetical order (the Cuisines sheet lists them in this order).
create or replace function private.cuisine_groups()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['African', 'American', 'Asian', 'Caribbean', 'European', 'Latin American',
               'Mediterranean & Middle Eastern', 'South Asian'];
$$;
