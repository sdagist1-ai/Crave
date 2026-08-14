-- ==============================================================================
-- SUPABASE BACKEND REFERENCE
-- ==============================================================================
-- This file acts as a historical reference for the custom SQL scripts and 
-- Remote Procedure Calls (RPCs) that we executed in the Supabase SQL Editor. 
-- Keeping them here ensures you always have a backup of your backend logic!
-- ==============================================================================


-- ==========================================
-- 1. Secure Account Deletion RPC
-- ==========================================
-- Creates a secure function that allows users to delete their own auth record.
-- Because of Supabase's ON DELETE CASCADE constraints, deleting the auth.users record
-- will automatically cascade and wipe their data from public.profiles, public.reviews, etc.
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Ensures the function runs with elevated privileges to access auth.users
AS $$
BEGIN
  -- 1. Prevent shared group restaurants from being wiped!
  -- If this user added restaurants to a shared group, we want them to stay for the other members.
  -- We set the owner to NULL before deletion to prevent ON DELETE CASCADE from destroying them.
  UPDATE public.restaurants SET owner = NULL WHERE owner = auth.uid();

  -- 2. Delete the authenticated user from the internal auth table
  -- This safely cascades and destroys their personal reviews, profile, and group memberships.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;


-- ==========================================
-- 2. Spin The Wheel RPC
-- ==========================================
-- Returns a single random restaurant for the SpinTab.
CREATE OR REPLACE FUNCTION get_random_restaurant(p_group_id UUID DEFAULT NULL)
RETURNS SETOF restaurants AS $$
BEGIN
  IF p_group_id IS NOT NULL THEN
    RETURN QUERY
    SELECT * FROM restaurants
    WHERE group_id = p_group_id
    ORDER BY random()
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT * FROM restaurants
    ORDER BY random()
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- 3. Group Consensus RPC (Tried Tab Fix)
-- ==========================================
-- This function automatically checks if a restaurant has been reviewed by every member of a group.
-- If it has, it automatically flips the 'visited' column to TRUE so it moves to the Tried tab.
CREATE OR REPLACE FUNCTION check_and_update_visited_status(p_restaurant_id INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id UUID;
  v_place_id TEXT;
  v_member_count INT;
  v_review_count INT;
  v_consensus BOOLEAN;
BEGIN
  SELECT group_id, place_id INTO v_group_id, v_place_id FROM public.restaurants WHERE id = p_restaurant_id;
  IF v_group_id IS NULL THEN
    UPDATE public.restaurants SET visited = TRUE WHERE id = p_restaurant_id;
    RETURN TRUE;
  END IF;
  SELECT COUNT(DISTINCT user_id) INTO v_member_count FROM public.group_members WHERE group_id = v_group_id;
  SELECT COUNT(DISTINCT r.user_id) INTO v_review_count FROM public.reviews r JOIN public.group_members gm ON r.user_id = gm.user_id WHERE r.place_id = v_place_id AND gm.group_id = v_group_id;
  IF v_member_count > 0 AND v_review_count >= v_member_count THEN v_consensus := TRUE; ELSE v_consensus := FALSE; END IF;
  UPDATE public.restaurants SET visited = v_consensus WHERE id = p_restaurant_id;
  RETURN v_consensus;
END;
$$;


-- ==========================================
-- 3b. Group Consensus Backfill Script
-- ==========================================
-- Run this ONCE to fix all old restaurants that were rated before the RPC was created.
-- It iterates through every restaurant and updates the `visited` column if consensus is met.
-- SELECT check_and_update_visited_status(id) FROM public.restaurants;


-- ==========================================
-- 4. Fake Data Generation (Testing)
-- ==========================================
-- DO $$
-- DECLARE
--   v_user_id UUID;
--   v_group_id UUID;
--   i INTEGER;
-- BEGIN
--   SELECT id INTO v_user_id FROM auth.users WHERE email = 'sdagist1+2@gmail.com' LIMIT 1;
--   SELECT group_id INTO v_group_id FROM public.group_members WHERE user_id = v_user_id LIMIT 1;
--   FOR i IN 1..100 LOOP
--     INSERT INTO public.restaurants ( owner, group_id, place_id, name, address, latitude, longitude, rating, user_rating_count, primary_type, vibes, visited, created_at ) 
--     VALUES (
--       v_user_id, v_group_id, 'fake_place_' || i || '_' || gen_random_uuid(), 'Fake Restaurant ' || i, '123 Crave Ave, Block ' || i,
--       40.7128 + (random() * 0.1 - 0.05), -74.0060 + (random() * 0.1 - 0.05), round((random() * 1.5 + 3.5)::numeric, 1), floor(random() * 500 + 10),
--       CASE (i % 6) WHEN 0 THEN 'restaurant' WHEN 1 THEN 'cafe' WHEN 2 THEN 'bar' WHEN 3 THEN 'bakery' WHEN 4 THEN 'ice_cream' ELSE 'breakfast' END,
--       CASE (i % 3) WHEN 0 THEN '["Cozy", "Date Night"]'::jsonb WHEN 1 THEN '["Loud", "Groups"]'::jsonb ELSE '["Casual"]'::jsonb END,
--       (random() > 0.5), NOW() - (i || ' hours')::interval
--     );
--   END LOOP;
-- END $$;


-- ==========================================
-- 4. Fake Data Cleanup (Testing)
-- ==========================================
-- DELETE FROM public.restaurants WHERE place_id LIKE 'fake_place_%';
