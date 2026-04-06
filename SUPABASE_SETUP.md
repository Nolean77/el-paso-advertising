# El Paso Advertising Solutions - Client Portal

A bilingual client portal for digital marketing content approval, built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- 🔐 Secure client authentication via Supabase Auth
- 📅 Content calendar view for scheduled posts
- ✅ Content approval workflow with feedback
- 📊 Performance metrics dashboard
- � Auto-sync Facebook post metrics from Meta Graph API
- �📝 Content request submission with file uploads
- 🌐 Bilingual support (English/Spanish)
- 📁 Image compression and file size management
- ☁️ Cloud storage for reference images

## Supabase Setup

### 1. Database Schema

Run the following SQL commands in your Supabase SQL Editor to set up the database:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create scheduled_posts table
CREATE TABLE scheduled_posts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  platform TEXT CHECK (platform IN ('instagram', 'facebook', 'twitter', 'linkedin')) NOT NULL,
  caption TEXT NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on scheduled_posts
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Scheduled posts policies
CREATE POLICY "Users can view own scheduled posts" ON scheduled_posts
  FOR SELECT USING (auth.uid() = user_id);

-- Create approval_posts table
CREATE TABLE approval_posts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  caption TEXT NOT NULL,
  image_url TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('instagram', 'facebook', 'twitter', 'linkedin')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'changes-requested')) DEFAULT 'pending',
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on approval_posts
ALTER TABLE approval_posts ENABLE ROW LEVEL SECURITY;

-- Approval posts policies
CREATE POLICY "Users can view own approval posts" ON approval_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own approval posts" ON approval_posts
  FOR UPDATE USING (auth.uid() = user_id);

-- Create performance_metrics table
CREATE TABLE performance_metrics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  caption TEXT NOT NULL,
  date DATE NOT NULL,
  platform TEXT CHECK (platform IN ('instagram', 'facebook', 'twitter', 'linkedin')) NOT NULL,
  reach INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  engagement_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on performance_metrics
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- Performance metrics policies
CREATE POLICY "Users can view own performance metrics" ON performance_metrics
  FOR SELECT USING (auth.uid() = user_id);

-- Create content_requests table
CREATE TABLE content_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT CHECK (type IN ('content', 'design', 'campaign', 'other')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'inProgress', 'completed')) DEFAULT 'pending',
  reference_images TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on content_requests
ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;

-- Content requests policies
CREATE POLICY "Users can view own content requests" ON content_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content requests" ON content_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create trigger to automatically create profile on user signup
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
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 1a. Admin Workflow Patch (Required for the admin portal)

After running the base schema above, also run the SQL in `supabase-admin-rls.sql` from this repo.

This patch:
- adds the missing `profiles.role` support,
- lets admins see and manage all client workflow records,
- allows client requests to be mirrored into `approval_posts`, and
- allows approved items to be pushed into `scheduled_posts` for the content calendar.

To promote your admin account after signup:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'YOUR_ADMIN_USER_ID';
```

### 1b. Meta Auto-Posting Patch (Required for Graph API auto-publishing)

Run `supabase-meta-integration.sql` from this repository.

This patch adds:
- `meta_connections` for storing each client's page token and IG business account,
- `post_logs` for publish attempt auditing,
- auto-post columns on `scheduled_posts` (`scheduled_at`, post status flags, errors, post IDs),
- RLS policies for admin visibility and client self-visibility.

After running the SQL, verify columns/tables exist:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scheduled_posts'
  AND column_name IN (
    'scheduled_at',
    'auto_post_enabled',
    'posted_to_facebook',
    'posted_to_instagram',
    'facebook_post_id',
    'instagram_post_id',
    'post_error',
    'posted_at',
    'post_type'
  );

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('meta_connections', 'post_logs');
```

### 2. Storage Setup

Create a storage bucket for uploaded post images:

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `post-images`
3. Set it to **Public** bucket
4. Add the following policies:

```sql
-- Allow authenticated users to upload images
-- Clients can upload only into their own folder (auth.uid()), admins can upload for any client folder.
CREATE POLICY "Authenticated users can upload post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-images'
  AND (
    public.is_admin()
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

-- Allow public to view images
CREATE POLICY "Public can view post images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own post images or admins"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (
    public.is_admin()
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);
```

### 3. Authentication Setup

1. Go to Authentication > Settings in your Supabase dashboard
2. Enable **Email** provider
3. Configure email templates if desired
4. For testing, disable email confirmation (or set up SMTP)

### 4. Environment Variables

The app is configured with your Supabase credentials:
- **Project URL**: `https://tawdrfphyjwfmzheyeia.supabase.co`
- **Anon Key**: Already configured in `src/lib/supabase.ts`

For Meta OAuth in Cloudflare Pages frontend, add:

```bash
VITE_META_APP_ID=979397271325727
VITE_META_REDIRECT_URI=https://ep-meta-poster.workers.dev/oauth/meta/callback
```

> After deploying the metrics sync update, reconnect existing Meta-linked clients once so the app can request the `read_insights` permission needed for Facebook post metrics.

Do not store Meta app secret, Supabase service key, or access tokens in frontend source.

### 4a. Cloudflare Worker Secrets (Meta Poster)

From `workers/meta-poster`, set secrets:

```bash
wrangler secret put META_APP_ID
wrangler secret put META_APP_SECRET
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
```

Values:
- `META_APP_ID`: `979397271325727`
- `META_APP_SECRET`: Meta app secret from developers.facebook.com
- `SUPABASE_URL`: your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Supabase service role key (never use anon key here)

Deploy worker:

```bash
cd workers/meta-poster
wrangler deploy
```

The worker listens on:
- `GET /oauth/meta/callback` for OAuth redirect handling
- `POST /metrics/sync` for manual Facebook metric pulls from the admin portal
- cron schedule every 5 minutes for auto-posting and Facebook metrics syncing

### 5. Create Test User

To create a test user, you can either:

**Option A: Via Supabase Dashboard**
1. Go to Authentication > Users
2. Click "Add user"
3. Enter email and password
4. The profile will be automatically created via trigger

**Option B: Via SQL**
```sql
-- Note: Replace with actual hashed password from Supabase Auth
-- Best to create users through the dashboard or signup flow
```

### 6. Seed Data (Optional)

You can add sample data for testing:

```sql
-- Add sample scheduled posts (replace USER_ID with actual user ID)
INSERT INTO scheduled_posts (user_id, date, platform, caption, image_url) VALUES
  ('USER_ID', CURRENT_DATE + 1, 'instagram', 'Check out our new product line! 🎉', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30'),
  ('USER_ID', CURRENT_DATE + 3, 'facebook', 'Join us for our weekend sale!', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da');

-- Add sample approval posts
INSERT INTO approval_posts (user_id, caption, image_url, platform, status) VALUES
  ('USER_ID', 'New brand campaign concept', 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0', 'instagram', 'pending'),
  ('USER_ID', 'Spring collection announcement', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8', 'facebook', 'pending');

-- Add sample performance metrics
INSERT INTO performance_metrics (user_id, caption, date, platform, reach, likes, engagement_rate) VALUES
  ('USER_ID', 'Holiday promotion post', CURRENT_DATE - 7, 'instagram', 12500, 890, 7.12),
  ('USER_ID', 'Customer testimonial', CURRENT_DATE - 5, 'facebook', 8300, 420, 5.06);
```

## Development

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
```

## Database Maintenance

### Update User Profile
```sql
UPDATE profiles SET name = 'Client Name' WHERE id = 'USER_ID';
```

### View All Data for a User
```sql
SELECT * FROM profiles WHERE id = 'USER_ID';
SELECT * FROM scheduled_posts WHERE user_id = 'USER_ID';
SELECT * FROM approval_posts WHERE user_id = 'USER_ID';
SELECT * FROM performance_metrics WHERE user_id = 'USER_ID';
SELECT * FROM content_requests WHERE user_id = 'USER_ID';
```

## Security Notes

- Row Level Security (RLS) is enabled on all tables
- Users can only access their own data
- File uploads are scoped to user folders
- Authentication is handled by Supabase Auth
- All API calls are authenticated via Supabase client

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **State**: React hooks + Spark KV (for language preference)
- **Icons**: Phosphor Icons
- **Charts**: Recharts
- **Dates**: date-fns

## Support

For issues or questions about the Supabase integration, check:
- Supabase Dashboard: https://app.supabase.com
- Supabase Docs: https://supabase.com/docs
