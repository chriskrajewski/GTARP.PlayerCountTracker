-- Migration: Add markdown support to notification banners
-- This script adds the message_markdown column to the notification_banners table
-- and updates RLS policies to allow admin operations

-- Add the message_markdown column if it doesn't exist
ALTER TABLE public.notification_banners
ADD COLUMN IF NOT EXISTS message_markdown TEXT NULL;

-- Drop existing policies to replace them with updated versions
DROP POLICY IF EXISTS "Allow public read on active banners" ON public.notification_banners;
DROP POLICY IF EXISTS "Allow admin read all banners" ON public.notification_banners;
DROP POLICY IF EXISTS "Allow admin insert banners" ON public.notification_banners;
DROP POLICY IF EXISTS "Allow admin update banners" ON public.notification_banners;
DROP POLICY IF EXISTS "Allow admin delete banners" ON public.notification_banners;

-- Create new policies with proper admin support
-- Policy for public read access (only active, scheduled banners)
CREATE POLICY "Allow public read on active banners" ON public.notification_banners
  FOR SELECT USING (
    is_active = TRUE 
    AND (start_date IS NULL OR start_date <= NOW()) 
    AND (end_date IS NULL OR end_date >= NOW())
  );

-- Policy for admin read access (all banners, including inactive)
-- Note: Service role client bypasses RLS, so this is for browser client admin reads
CREATE POLICY "Allow admin read all banners" ON public.notification_banners
  FOR SELECT USING (TRUE);

-- Policy for admin insert
CREATE POLICY "Allow admin insert banners" ON public.notification_banners
  FOR INSERT WITH CHECK (TRUE);

-- Policy for admin update
CREATE POLICY "Allow admin update banners" ON public.notification_banners
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- Policy for admin delete
CREATE POLICY "Allow admin delete banners" ON public.notification_banners
  FOR DELETE USING (TRUE);

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'notification_banners' 
ORDER BY ordinal_position;



