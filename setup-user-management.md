# User Management Setup Guide

## Step 1: Run Database Migration

1. Open your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `/migrations/002_create_user_profiles.sql`
4. Run the migration

## Step 2: Check Console for Debugging

1. Sign in as mohiuddin.007@gmail.com
2. Go to the admin page
3. Open browser console (F12)
4. Look for logs like:
   - "Checking user role for: mohiuddin.007@gmail.com"
   - "User profile: ..."
   - "Admin status: ... Superuser status: ..."

## Step 3: Manual Profile Creation (if needed)

If the automatic profile creation doesn't work, you can manually create the superuser profile:

1. Get your user ID:
```sql
SELECT id, email FROM auth.users WHERE email = 'mohiuddin.007@gmail.com';
```

2. Insert your profile (replace YOUR_USER_ID with the actual UUID):
```sql
INSERT INTO user_profiles (user_id, email, role) 
VALUES ('YOUR_USER_ID', 'mohiuddin.007@gmail.com', 'superuser');
```

## Step 4: Verify Setup

After running the migration:
1. Log in as mohiuddin.007@gmail.com
2. Go to `/admin`
3. You should see both "Decks" and "Users" tabs
4. Click on "Users" tab to see the user management interface

## Troubleshooting

If you don't see the Users tab:
1. Check the browser console for any errors
2. Verify the user_profiles table exists in your database
3. Check if your profile was created with 'superuser' role
4. Make sure the RLS policies are set up correctly

## Test Users

You can create test users to verify the system works:
1. Create a new user in Supabase Auth
2. They should automatically get 'user' role
3. Use the Users tab to promote them to 'admin'
4. Verify they can access the admin dashboard