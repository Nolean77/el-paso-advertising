-- El Paso Advertising: admin workflow / RLS patch
-- Run this in the Supabase SQL Editor after the base schema in SUPABASE_SETUP.md.
-- It adds the missing role support and allows the admin portal to review client requests,
-- send approval items to clients, and move approved items into the content calendar.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (lower(role) IN ('admin', 'client'));

UPDATE public.profiles
SET role = CASE
  WHEN lower(coalesce(role, 'client')) = 'admin' THEN 'admin'
  ELSE 'client'
END;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND lower(role) = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN lower(COALESCE(NEW.raw_user_meta_data->>'role', 'client')) = 'admin' THEN 'admin'
      ELSE 'client'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    role = CASE
      WHEN public.profiles.role IS NULL THEN EXCLUDED.role
      WHEN lower(public.profiles.role) = 'admin' THEN 'admin'
      ELSE 'client'
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own scheduled posts" ON public.scheduled_posts;
DROP POLICY IF EXISTS "Admins can view all scheduled posts" ON public.scheduled_posts;
DROP POLICY IF EXISTS "Admins can insert scheduled posts" ON public.scheduled_posts;
DROP POLICY IF EXISTS "Admins can update scheduled posts" ON public.scheduled_posts;

CREATE POLICY "Users can view own scheduled posts" ON public.scheduled_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all scheduled posts" ON public.scheduled_posts
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert scheduled posts" ON public.scheduled_posts
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update scheduled posts" ON public.scheduled_posts
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view own approval posts" ON public.approval_posts;
DROP POLICY IF EXISTS "Users can insert own approval posts" ON public.approval_posts;
DROP POLICY IF EXISTS "Users can update own approval posts" ON public.approval_posts;
DROP POLICY IF EXISTS "Admins can view all approval posts" ON public.approval_posts;
DROP POLICY IF EXISTS "Admins can insert approval posts" ON public.approval_posts;
DROP POLICY IF EXISTS "Admins can update approval posts" ON public.approval_posts;

CREATE POLICY "Users can view own approval posts" ON public.approval_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own approval posts" ON public.approval_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own approval posts" ON public.approval_posts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all approval posts" ON public.approval_posts
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert approval posts" ON public.approval_posts
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update approval posts" ON public.approval_posts
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view own performance metrics" ON public.performance_metrics;
DROP POLICY IF EXISTS "Admins can view all performance metrics" ON public.performance_metrics;
DROP POLICY IF EXISTS "Admins can insert performance metrics" ON public.performance_metrics;
DROP POLICY IF EXISTS "Admins can update performance metrics" ON public.performance_metrics;

CREATE POLICY "Users can view own performance metrics" ON public.performance_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all performance metrics" ON public.performance_metrics
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert performance metrics" ON public.performance_metrics
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update performance metrics" ON public.performance_metrics
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view own content requests" ON public.content_requests;
DROP POLICY IF EXISTS "Users can insert own content requests" ON public.content_requests;
DROP POLICY IF EXISTS "Admins can view all content requests" ON public.content_requests;
DROP POLICY IF EXISTS "Admins can update content requests" ON public.content_requests;

CREATE POLICY "Users can view own content requests" ON public.content_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content requests" ON public.content_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all content requests" ON public.content_requests
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update content requests" ON public.content_requests
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Storage policies for post-images bucket
-- Allows clients to upload into their own folder and admins to upload for any client folder.
DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own post images or admins" ON storage.objects;

CREATE POLICY "Authenticated users can upload post images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-images'
    AND (
      public.is_admin()
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Public can view post images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'post-images');

CREATE POLICY "Users can delete own post images or admins" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-images'
    AND (
      public.is_admin()
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );

-- Promote your admin user after signup (replace with the real auth user id)
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_ADMIN_USER_ID';
