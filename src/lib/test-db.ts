import { supabase } from './supabase';

export async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    console.log('Available tables:', tables?.map(t => t.table_name));
    
    // Test if user_profiles table exists
    const { data: userProfilesTest, error: userProfilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);
    
    console.log('user_profiles table test:', {
      success: !userProfilesError,
      error: userProfilesError,
      data: userProfilesTest
    });
    
    // Test current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Current user:', user);
    
    return {
      tablesAvailable: tables?.map(t => t.table_name) || [],
      userProfilesExists: !userProfilesError,
      currentUser: user,
      errors: {
        tables: tablesError,
        userProfiles: userProfilesError,
        user: userError
      }
    };
  } catch (error) {
    console.error('Database test failed:', error);
    return null;
  }
}