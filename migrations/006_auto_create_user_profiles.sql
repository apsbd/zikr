-- Create a trigger function to automatically create user profiles
CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert a new user profile when a user is created in auth.users
    INSERT INTO public.user_profiles (user_id, email, role, is_banned)
    VALUES (
        NEW.id,
        NEW.email,
        CASE 
            WHEN NEW.email = 'mohiuddin.007@gmail.com' THEN 'superuser'
            ELSE 'user'
        END,
        false
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE LOG 'Error creating user profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile_on_signup();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_profile_on_signup() TO service_role;