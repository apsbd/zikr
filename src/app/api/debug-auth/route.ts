import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getUserProfile, isUserAdmin, isUserSuperuser } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1] || '';
    
    // Create Supabase client with the user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      return NextResponse.json({ 
        error: 'Auth error', 
        details: authError.message,
        note: 'Make sure you are logged in' 
      }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ 
        error: 'No user logged in',
        note: 'Please log in first' 
      }, { status: 401 });
    }

    // Get user profile
    const profile = await getUserProfile(user.id);
    
    // Check admin and superuser status
    const isAdmin = await isUserAdmin(user.id);
    const isSuperuser = await isUserSuperuser(user.id);

    // Check if profile exists in database
    const { data: dbProfile, error: dbError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    // If we have a database profile but getUserProfile returned null, 
    // test the checks with the database profile directly
    let testIsAdmin = false;
    let testIsSuperuser = false;
    if (dbProfile && !profile) {
      testIsAdmin = dbProfile.role === 'admin' || dbProfile.role === 'superuser';
      testIsSuperuser = dbProfile.role === 'superuser';
    }

    return NextResponse.json({
      auth: {
        userId: user.id,
        email: user.email,
        provider: user.app_metadata?.provider
      },
      profile: profile ? {
        id: profile.id,
        userId: profile.user_id,
        email: profile.email,
        role: profile.role,
        isBanned: profile.is_banned
      } : null,
      checks: {
        isAdmin,
        isSuperuser,
        emailIsSuperuser: user.email === 'mohiuddin.007@gmail.com',
        testIsAdmin: testIsAdmin,
        testIsSuperuser: testIsSuperuser
      },
      database: {
        profileExists: !!dbProfile,
        dbError: dbError?.message,
        dbProfile: dbProfile ? {
          id: dbProfile.id,
          user_id: dbProfile.user_id,
          email: dbProfile.email,
          role: dbProfile.role
        } : null
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}