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

-- 4. Set yourself (Zach) as admin
-- >>> REPLACE the email below with your actual email <<<
UPDATE profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'utbigmac41@gmail.com');

-- 5. Add family, prep_time, cook_time, servings columns to recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS family TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS prep_time INTEGER;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cook_time INTEGER;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS servings INTEGER;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS estimated_calories INTEGER;

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
