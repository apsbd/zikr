-- Add is_banned column to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- Update existing users to not be banned by default
UPDATE user_profiles SET is_banned = false WHERE is_banned IS NULL;