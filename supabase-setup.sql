-- ============================================
-- McMichael Munchies: Role-Based Approval System
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create the role enum and profiles table
CREATE TYPE user_role AS ENUM ('viewer', 'member', 'admin');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill profiles for any existing users
INSERT INTO profiles (id, full_name, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', ''), 'viewer'
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);

-- 4. Set yourself as admin
-- >>> REPLACE 'your-email@example.com' with your actual email <<<
UPDATE profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

-- 5. Add family, prep_time, cook_time, servings columns to recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS family TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS prep_time INTEGER;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cook_time INTEGER;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS servings INTEGER;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS estimated_calories INTEGER;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5b. Migrate category (text) to categories (jsonb array)
-- Run this once to convert existing data:
--   UPDATE recipes SET categories = CASE
--     WHEN category IS NOT NULL AND category != '' THEN jsonb_build_array(category)
--     ELSE '[]'::jsonb
--   END;
-- Then drop the old column:
--   ALTER TABLE recipes DROP COLUMN IF EXISTS category;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS categories JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 5c. Valid values for cuisine
-- CHECK constraint ensures only known values are stored
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_cuisine_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_cuisine_check
  CHECK (cuisine IN ('American', 'Italian', 'Mexican', 'Japanese', 'Chinese', 'Indian', 'Comfort Food', 'Other', ''));

-- 6a. RLS policies on favorites
-- (Create the favorites table if it doesn't exist)
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, recipe_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
  ON favorites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON favorites FOR DELETE USING (auth.uid() = user_id);

-- 6. RLS policies on profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 6. RLS policies on recipes
-- (Drop any existing policies first if needed)
-- DROP POLICY IF EXISTS "..." ON recipes;

CREATE POLICY "Recipes are viewable by everyone"
  ON recipes FOR SELECT USING (true);

CREATE POLICY "Members can insert recipes"
  ON recipes FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('member', 'admin')
  );

CREATE POLICY "Members can update any recipe"
  ON recipes FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('member', 'admin')
  );

CREATE POLICY "Members can delete any recipe"
  ON recipes FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('member', 'admin')
  );

-- 7. Access requests
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, status)
);

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests"
  ON access_requests FOR SELECT USING (
    auth.uid() = user_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Users can insert their own requests"
  ON access_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update requests"
  ON access_requests FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 8. Review queue for bulk-imported recipes
CREATE TABLE IF NOT EXISTS review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, recipe_id)
);

ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own review queue"
  ON review_queue FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their own review queue"
  ON review_queue FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own review queue"
  ON review_queue FOR DELETE USING (auth.uid() = user_id);
