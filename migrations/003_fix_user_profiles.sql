-- Fix the infinite recursion issue by temporarily disabling RLS
-- and manually inserting the superuser profile

-- Disable RLS temporarily
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Only superusers can update roles" ON user_profiles;
DROP POLICY IF EXISTS "Only superusers can create profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow user profile creation" ON user_profiles;
DROP POLICY IF EXISTS "Superusers can update any profile" ON user_profiles;

-- Insert the superuser profile directly
INSERT INTO user_profiles (user_id, email, role) 
VALUES ('3cfe1114-63cb-4b00-9aa7-9ae741c627a8', 'mohiuddin.007@gmail.com', 'superuser')
ON CONFLICT (user_id) DO UPDATE SET role = 'superuser';

-- Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create simpler policies that don't cause recursion
-- Users can read their own profile
CREATE POLICY "Users can read their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile (non-role fields)
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Superuser can read all profiles (using hardcoded user_id to avoid recursion)
CREATE POLICY "Superuser can read all profiles" ON user_profiles
    FOR SELECT USING (auth.uid() = '3cfe1114-63cb-4b00-9aa7-9ae741c627a8');

-- Superuser can update any profile (using hardcoded user_id to avoid recursion)
CREATE POLICY "Superuser can update any profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = '3cfe1114-63cb-4b00-9aa7-9ae741c627a8');

-- Superuser can insert any profile (using hardcoded user_id to avoid recursion)
CREATE POLICY "Superuser can insert any profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = '3cfe1114-63cb-4b00-9aa7-9ae741c627a8');