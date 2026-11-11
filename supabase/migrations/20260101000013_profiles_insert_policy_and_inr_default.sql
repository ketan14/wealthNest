-- Migration 20260101000013: profile persistence fixes
-- 1. Users could not INSERT/UPSERT their own profile row (only SELECT/UPDATE policies existed),
--    so saving settings through an upsert was rejected by RLS and the DB value never changed.
-- 2. WealthNest is India-first: new profiles default to INR instead of USD.

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

ALTER TABLE public.profiles ALTER COLUMN default_currency SET DEFAULT 'INR';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, default_currency)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'INR'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

