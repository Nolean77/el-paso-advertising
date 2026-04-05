-- El Paso Advertising: Meta Graph API integration patch
-- Run this after SUPABASE_SETUP.md and supabase-admin-rls.sql.

ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS posted_to_facebook BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posted_to_instagram BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS facebook_post_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_post_id TEXT,
  ADD COLUMN IF NOT EXISTS post_error TEXT,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'photo';

ALTER TABLE public.scheduled_posts
  DROP CONSTRAINT IF EXISTS scheduled_posts_post_type_check;

ALTER TABLE public.scheduled_posts
  ADD CONSTRAINT scheduled_posts_post_type_check
  CHECK (post_type IN ('photo', 'video'));

UPDATE public.scheduled_posts
SET scheduled_at = (date::text || 'T09:00:00Z')::timestamptz
WHERE scheduled_at IS NULL;

CREATE TABLE IF NOT EXISTS public.meta_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  facebook_page_id TEXT NOT NULL,
  facebook_page_name TEXT,
  instagram_account_id TEXT,
  page_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (client_id, facebook_page_id)
);

CREATE TABLE IF NOT EXISTS public.post_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id TEXT REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_connections_client_active
  ON public.meta_connections (client_id, is_active);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_autopost_due
  ON public.scheduled_posts (status, auto_post_enabled, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_post_logs_client_platform_time
  ON public.post_logs (client_id, platform, attempted_at DESC);

ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all meta connections" ON public.meta_connections;
DROP POLICY IF EXISTS "Admins can insert meta connections" ON public.meta_connections;
DROP POLICY IF EXISTS "Admins can update meta connections" ON public.meta_connections;
DROP POLICY IF EXISTS "Clients can view own meta connection" ON public.meta_connections;

CREATE POLICY "Admins can view all meta connections" ON public.meta_connections
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert meta connections" ON public.meta_connections
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update meta connections" ON public.meta_connections
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Clients can view own meta connection" ON public.meta_connections
  FOR SELECT USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Admins can view all post logs" ON public.post_logs;
DROP POLICY IF EXISTS "Admins can insert post logs" ON public.post_logs;
DROP POLICY IF EXISTS "Clients can view own post logs" ON public.post_logs;

CREATE POLICY "Admins can view all post logs" ON public.post_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert post logs" ON public.post_logs
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Clients can view own post logs" ON public.post_logs
  FOR SELECT USING (auth.uid() = client_id);
