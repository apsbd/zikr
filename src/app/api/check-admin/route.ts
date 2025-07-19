import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1] || '';
    
    if (!token) {
      return NextResponse.json({ 
        error: 'No auth token provided',
        isAdmin: false,
        isSuperuser: false
      }, { status: 401 });
    }
    
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
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Auth error', 
        details: authError?.message,
        isAdmin: false,
        isSuperuser: false
      }, { status: 401 });
    }

    // Check user profile directly
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (profileError || !profile) {
      return NextResponse.json({
        error: 'Profile not found',
        details: profileError?.message,
        userId: user.id,
        email: user.email,
        isAdmin: false,
        isSuperuser: false
      });
    }

    const isAdmin = profile.role === 'admin' || profile.role === 'superuser';
    const isSuperuser = profile.role === 'superuser';

    return NextResponse.json({
      success: true,
      userId: user.id,
      email: user.email,
      profile: {
        id: profile.id,
        role: profile.role,
        is_banned: profile.is_banned
      },
      isAdmin,
      isSuperuser
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Server error', 
      details: error instanceof Error ? error.message : 'Unknown error',
      isAdmin: false,
      isSuperuser: false
    }, { status: 500 });
  }
}