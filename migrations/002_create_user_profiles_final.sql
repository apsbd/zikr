-- Create user_profiles table to store user roles and metadata
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superuser')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one profile per user
    UNIQUE(user_id),
    UNIQUE(email)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Only superusers can update roles" ON user_profiles;
DROP POLICY IF EXISTS "Only superusers can create profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow user profile creation" ON user_profiles;
DROP POLICY IF EXISTS "Superusers can update any profile" ON user_profiles;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Create policies
-- Users can read their own profile
CREATE POLICY "Users can read their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own profile (needed for initialization)
CREATE POLICY "Allow user profile creation" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Admins and superusers can read all profiles
CREATE POLICY "Admins can read all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'superuser')
        )
    );

-- Superusers can update any profile
CREATE POLICY "Superusers can update any profile" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'superuser'
        )
    );

-- Create trigger function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert the superuser profile for mohiuddin.007@gmail.com
-- Get the user ID and insert the profile
DO $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Get the user ID for mohiuddin.007@gmail.com
    SELECT id INTO user_uuid FROM auth.users WHERE email = 'mohiuddin.007@gmail.com';
    
    -- Insert the superuser profile if user exists
    IF user_uuid IS NOT NULL THEN
        INSERT INTO user_profiles (user_id, email, role) 
        VALUES (user_uuid, 'mohiuddin.007@gmail.com', 'superuser')
        ON CONFLICT (user_id) DO UPDATE SET role = 'superuser';
        
        RAISE NOTICE 'Superuser profile created for mohiuddin.007@gmail.com with user_id: %', user_uuid;
    ELSE
        RAISE NOTICE 'User mohiuddin.007@gmail.com not found in auth.users';
    END IF;
END $$;