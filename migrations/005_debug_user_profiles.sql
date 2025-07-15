-- Create a debug function to check user profiles (bypass RLS)
CREATE OR REPLACE FUNCTION get_all_user_profiles_debug()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    email TEXT,
    role TEXT,
    is_banned BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.user_id,
        up.email,
        up.role,
        COALESCE(up.is_banned, false) as is_banned,
        up.created_at,
        up.updated_at
    FROM user_profiles up
    ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_all_user_profiles_debug() TO authenticated;

-- Create function to get user count
CREATE OR REPLACE FUNCTION get_user_profiles_count()
RETURNS INTEGER
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM user_profiles)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_profiles_count() TO authenticated;