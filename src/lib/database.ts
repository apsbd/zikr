import { supabase, type DbDeck, type DbCard } from './supabase';
import { initializeFSRSCard, getCardStats } from './fsrs';
import type { Deck, Card, DeckDisplayInfo } from '@/types';
import type { Database } from '@/types/database';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

// Helper function to check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Convert database deck to app deck format
async function dbDeckToAppDeck(dbDeck: DbDeck, dbCards: DbCard[], userId?: string): Promise<Deck> {
  const cards: Card[] = await Promise.all(dbCards.map(async dbCard => {
    let fsrsData;
    
    if (userId) {
      // Get user progress from database
      const { data: progressArray, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('card_id', dbCard.id);
      
      if (error) {
        console.log('Error querying progress for card:', dbCard.id, 'error:', error.message);
        fsrsData = initializeFSRSCard();
      } else if (progressArray && progressArray.length > 0) {
        const progress = progressArray[0]; // Take the first (should be only) result
        console.log('Found progress for card:', dbCard.id, progress);
        fsrsData = {
          state: progress.state,
          difficulty: progress.difficulty,
          stability: progress.stability,
          due: new Date(progress.due),
          elapsed_days: progress.elapsed_days,
          scheduled_days: progress.scheduled_days,
          reps: progress.reps,
          lapses: progress.lapses,
          last_review: progress.last_review ? new Date(progress.last_review) : undefined,
        };
      } else {
        console.log('No progress data for card:', dbCard.id);
        fsrsData = initializeFSRSCard();
      }
    } else {
      // Fallback to localStorage for non-authenticated users
      const progressKey = `card-progress-${dbCard.id}`;
      const savedProgress = localStorage.getItem(progressKey);
      
      if (savedProgress) {
        try {
          const progress = JSON.parse(savedProgress);
          fsrsData = {
            ...progress,
            due: new Date(progress.due),
            last_review: progress.last_review ? new Date(progress.last_review) : undefined,
          };
        } catch (error) {
          console.error('Error parsing card progress:', error);
          fsrsData = initializeFSRSCard();
        }
      } else {
        fsrsData = initializeFSRSCard();
      }
    }

    return {
      id: dbCard.id,
      front: dbCard.front,
      back: {
        bangla: dbCard.back_bangla,
        english: dbCard.back_english,
      },
      fsrsData,
    };
  }));

  return {
    id: dbDeck.id,
    title: dbDeck.title,
    description: dbDeck.description || '',
    author: dbDeck.author,
    dailyNewLimit: dbDeck.daily_new_limit || 20,
    cards,
    stats: getCardStats(cards),
    createdAt: new Date(dbDeck.created_at),
    updatedAt: new Date(dbDeck.updated_at),
  };
}

// Get all decks from Supabase
export async function getDecks(userId?: string): Promise<Deck[]> {
  try {
    // Fetch decks
    const { data: decks, error: decksError } = await supabase
      .from('decks')
      .select('*')
      .order('created_at', { ascending: false });

    if (decksError) {
      console.error('Error fetching decks:', decksError);
      return [];
    }

    // Fetch all cards
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      return [];
    }

    // Group cards by deck_id and convert to app format
    const decksWithCards: Deck[] = await Promise.all(decks.map(async deck => {
      const deckCards = cards.filter(card => card.deck_id === deck.id);
      return await dbDeckToAppDeck(deck, deckCards, userId);
    }));

    return decksWithCards;
  } catch (error) {
    console.error('Error in getDecks:', error);
    return [];
  }
}

// Get a specific deck by ID
export async function getDeckById(id: string, userId?: string): Promise<Deck | undefined> {
  try {
    // Fetch deck
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .select('*')
      .eq('id', id)
      .single();

    if (deckError || !deck) {
      console.error('Error fetching deck:', deckError);
      return undefined;
    }

    // Fetch cards for this deck
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', id)
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      return undefined;
    }

    return await dbDeckToAppDeck(deck, cards || [], userId);
  } catch (error) {
    console.error('Error in getDeckById:', error);
    return undefined;
  }
}

// Save deck to Supabase (create or update)
export async function saveDeck(deck: Deck): Promise<boolean> {
  try {
    // Check if deck exists
    const { data: existingDeck } = await supabase
      .from('decks')
      .select('id')
      .eq('id', deck.id)
      .single();

    // Ensure deck has a valid UUID
    const deckId = isValidUUID(deck.id) ? deck.id : crypto.randomUUID();
    
    const deckData = {
      id: deckId,
      title: deck.title,
      description: deck.description,
      author: deck.author,
      daily_new_limit: deck.dailyNewLimit,
      updated_at: new Date().toISOString(),
    };

    if (existingDeck) {
      // Update existing deck
      const { error: deckError } = await supabase
        .from('decks')
        .update(deckData)
        .eq('id', deckId);

      if (deckError) {
        console.error('Error updating deck:', deckError);
        return false;
      }
    } else {
      // Create new deck
      const { error: deckError } = await supabase
        .from('decks')
        .insert({
          ...deckData,
          created_at: new Date().toISOString(),
        });

      if (deckError) {
        console.error('Error creating deck:', deckError);
        return false;
      }
    }

    // Get existing cards for this deck
    const { data: existingCards } = await supabase
      .from('cards')
      .select('id')
      .eq('deck_id', deckId);

    const existingCardIds = existingCards?.map(card => card.id) || [];
    const currentCardIds = deck.cards.map(card => card.id);

    // Delete cards that are no longer in the deck
    const cardsToDelete = existingCardIds.filter(id => !currentCardIds.includes(id));
    if (cardsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('cards')
        .delete()
        .in('id', cardsToDelete);

      if (deleteError) {
        console.error('Error deleting cards:', deleteError);
      }
    }

    // Separate new cards from existing cards
    const newCards = deck.cards.filter(card => !existingCardIds.includes(card.id));
    const existingCardsToUpdate = deck.cards.filter(card => existingCardIds.includes(card.id));

    // Insert new cards
    if (newCards.length > 0) {
      const newCardsData = newCards.map(card => {
        // Ensure we have a valid UUID for the card ID
        const cardId = isValidUUID(card.id) ? card.id : crypto.randomUUID();
        
        return {
          id: cardId,
          deck_id: deckId,
          front: card.front,
          back_bangla: card.back.bangla,
          back_english: card.back.english,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      const { error: insertError } = await supabase
        .from('cards')
        .insert(newCardsData);

      if (insertError) {
        console.error('Error inserting new cards:', insertError);
        console.error('Card data that failed:', newCardsData);
        return false;
      }
    }

    // Update existing cards
    if (existingCardsToUpdate.length > 0) {
      for (const card of existingCardsToUpdate) {
        const { error: updateError } = await supabase
          .from('cards')
          .update({
            front: card.front,
            back_bangla: card.back.bangla,
            back_english: card.back.english,
            updated_at: new Date().toISOString(),
          })
          .eq('id', card.id);

        if (updateError) {
          console.error('Error updating card:', updateError);
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error in saveDeck:', error);
    return false;
  }
}

// Save user progress for a card to database or localStorage
export async function saveCardProgress(cardId: string, fsrsData: Card['fsrsData'], userId?: string): Promise<void> {
  try {
    if (userId) {
      console.log('Saving progress for user:', userId, 'card:', cardId, 'data:', fsrsData);
      
      // Save to database for authenticated users
      const progressData = {
        user_id: userId,
        card_id: cardId,
        state: fsrsData.state,
        difficulty: fsrsData.difficulty,
        stability: fsrsData.stability,
        retrievability: 0, // Default value since this field isn't used in current FSRS implementation
        due: fsrsData.due.toISOString(),
        elapsed_days: fsrsData.elapsed_days,
        scheduled_days: fsrsData.scheduled_days,
        reps: fsrsData.reps,
        lapses: fsrsData.lapses,
        last_review: fsrsData.last_review?.toISOString() || null,
        updated_at: new Date().toISOString(),
      };

      // Try to update existing progress first
      const { data: existingArray } = await supabase
        .from('user_progress')
        .select('id')
        .eq('user_id', userId)
        .eq('card_id', cardId);

      const existing = existingArray && existingArray.length > 0;
      
      if (existing) {
        console.log('Updating existing progress for card:', cardId);
        const { error } = await supabase
          .from('user_progress')
          .update(progressData)
          .eq('user_id', userId)
          .eq('card_id', cardId);
        
        if (error) {
          console.error('Error updating user progress:', error);
        } else {
          console.log('Successfully updated progress for card:', cardId);
        }
      } else {
        console.log('Creating new progress for card:', cardId);
        const { error } = await supabase
          .from('user_progress')
          .insert({ ...progressData, created_at: new Date().toISOString() });
        
        if (error) {
          console.error('Error inserting user progress:', error);
        } else {
          console.log('Successfully created progress for card:', cardId);
        }
      }
    } else {
      // Fallback to localStorage for non-authenticated users
      const progressKey = `card-progress-${cardId}`;
      localStorage.setItem(progressKey, JSON.stringify(fsrsData));
    }
  } catch (error) {
    console.error('Error saving card progress:', error);
  }
}

// Delete a deck from Supabase
export async function deleteDeck(deckId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId);

    if (error) {
      console.error('Error deleting deck:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteDeck:', error);
    return false;
  }
}

// Helper functions for the app
export function getNextReviewTime(cards: Card[]): Date | null {
  const now = new Date();
  const futureCards = cards.filter(card => card.fsrsData.due > now);
  
  if (futureCards.length === 0) return null;
  
  return futureCards.reduce((earliest, card) => 
    card.fsrsData.due < earliest ? card.fsrsData.due : earliest, 
    futureCards[0].fsrsData.due
  );
}

export function getNextReviewCount(cards: Card[], nextTime: Date | null): number {
  if (!nextTime) return 0;
  
  return cards.filter(card => 
    Math.abs(card.fsrsData.due.getTime() - nextTime.getTime()) < 60000 // Within 1 minute
  ).length;
}

export function getDeckDisplayInfo(deck: Deck): DeckDisplayInfo {
  const nextReviewTime = getNextReviewTime(deck.cards);
  const nextReviewCount = getNextReviewCount(deck.cards, nextReviewTime);
  
  return {
    id: deck.id,
    title: deck.title,
    description: deck.description,
    author: deck.author,
    dailyNewLimit: deck.dailyNewLimit,
    stats: deck.stats,
    nextReviewTime,
    nextReviewCount,
    cards: deck.cards,
  };
}

export function formatNextReviewTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff <= 0) return 'Ready now';
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  } else if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  } else if (days === 1) {
    return 'Tomorrow';
  } else {
    return `${days} days`;
  }
}

export function getTimeIndicatorClass(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (minutes <= 0) return 'text-green-400';
  if (minutes < 60) return 'text-yellow-400';
  if (minutes < 24 * 60) return 'text-blue-400';
  return 'text-gray-400';
}

// User Management Functions

// Get user profile by user ID
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    console.log('Fetching user profile for userId:', userId);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Supabase error fetching user profile:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return null;
    }

    console.log('Successfully fetched user profile:', data);
    
    // Handle missing is_banned field for backward compatibility
    if (data && data.is_banned === undefined) {
      data.is_banned = false;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
}

// Get user profile by email
export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Error fetching user profile by email:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserProfileByEmail:', error);
    return null;
  }
}

// Get all user profiles (admin/superuser only)
export async function getAllUserProfiles(): Promise<UserProfile[]> {
  try {
    console.log('Fetching all user profiles...');
    console.log('Supabase client initialized:', !!supabase);
    
    // First get current user info
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    console.log('Current user:', currentUser);
    
    // Get current user's profile to check role
    if (currentUser) {
      const currentProfile = await getUserProfile(currentUser.id);
      console.log('Current user profile:', currentProfile);
    }
    
    // First check if the table exists and what columns it has
    const { data: tableInfo, error: tableError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);
    
    console.log('Table info query result:', { tableInfo, tableError });
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all user profiles:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return [];
    }

    console.log('Raw data from database:', data);
    console.log('Number of profiles found:', data?.length || 0);
    console.log('Data type:', typeof data);
    console.log('Is array?', Array.isArray(data));
    
    if (data) {
      data.forEach((profile, index) => {
        console.log(`Profile ${index}:`, profile);
      });
    }
    
    // Handle missing is_banned field for backward compatibility
    const profiles = (data || []).map(profile => ({
      ...profile,
      is_banned: profile.is_banned ?? false
    }));

    console.log('Processed profiles:', profiles);
    return profiles;
  } catch (error) {
    console.error('Error in getAllUserProfiles:', error);
    console.error('Error stack:', error.stack);
    return [];
  }
}

// Get all authenticated users who might not have profiles yet
export async function getAllAuthenticatedUsers(): Promise<any[]> {
  try {
    console.log('Fetching all authenticated users...');
    
    // This requires admin privileges - might not work in client-side code
    // const { data, error } = await supabase.auth.admin.listUsers();
    
    // Instead, let's check if we can find users through other means
    // For now, we'll return empty array and focus on user_profiles table
    return [];
  } catch (error) {
    console.error('Error in getAllAuthenticatedUsers:', error);
    return [];
  }
}

// Debug function to check user profiles without RLS
export async function debugGetAllUserProfiles(): Promise<any> {
  try {
    console.log('DEBUG: Fetching all user profiles without RLS...');
    
    // Try to get raw count first
    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });
    
    console.log('DEBUG: Raw count query result:', { count, countError });
    
    // Try to get count using our function
    const { data: countData, error: countFnError } = await supabase
      .rpc('get_user_profiles_count');
    
    console.log('DEBUG: Count function result:', { countData, countFnError });
    
    // Try to get data with RLS bypass (this might fail)
    const { data: rawData, error: rawError } = await supabase
      .rpc('get_all_user_profiles_debug');
    
    console.log('DEBUG: RPC call result:', { rawData, rawError });
    
    return { count, countError, countData, countFnError, rawData, rawError };
  } catch (error) {
    console.error('DEBUG: Error in debugGetAllUserProfiles:', error);
    return { error };
  }
}

// Helper function to get all authenticated users (for debugging)
export async function getAllAuthUsers() {
  try {
    console.log('Fetching all auth users...');
    
    // Note: This requires admin privileges and may not work in client-side code
    // This is mainly for debugging to see if there are auth users without profiles
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error fetching auth users:', error);
      return [];
    }

    console.log('Auth users:', data.users);
    return data.users;
  } catch (error) {
    console.error('Error in getAllAuthUsers:', error);
    return [];
  }
}

// Create or update user profile
export async function upsertUserProfile(profile: UserProfileInsert): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(profile)
      .select()
      .single();

    if (error) {
      console.error('Error upserting user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in upsertUserProfile:', error);
    return null;
  }
}

// Update user role (superuser only)
export async function updateUserRole(userId: string, role: 'user' | 'admin' | 'superuser'): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating user role:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    return false;
  }
}

// Ban/Unban user (admin/superuser only)
export async function updateUserBanStatus(userId: string, isBanned: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_banned: isBanned, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating user ban status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateUserBanStatus:', error);
    return false;
  }
}

// Check if user has admin privileges
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    console.log('Checking admin status for userId:', userId);
    const profile = await getUserProfile(userId);
    console.log('Profile for admin check:', profile);
    
    if (!profile) {
      console.log('No profile found for user');
      return false;
    }
    
    const isAdmin = profile.role === 'admin' || profile.role === 'superuser';
    console.log('Admin status result:', isAdmin);
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Check if user is superuser
export async function isUserSuperuser(userId: string): Promise<boolean> {
  try {
    console.log('Checking superuser status for userId:', userId);
    const profile = await getUserProfile(userId);
    console.log('Profile for superuser check:', profile);
    
    if (!profile) {
      console.log('No profile found for user');
      return false;
    }
    
    const isSuperuser = profile.role === 'superuser';
    console.log('Superuser status result:', isSuperuser);
    return isSuperuser;
  } catch (error) {
    console.error('Error checking superuser status:', error);
    return false;
  }
}

// Initialize user profile on first login
export async function initializeUserProfile(userId: string, email: string): Promise<UserProfile | null> {
  try {
    // Check if profile already exists
    const existingProfile = await getUserProfile(userId);
    if (existingProfile) {
      return existingProfile;
    }

    // Determine role based on email
    const role = email === 'mohiuddin.007@gmail.com' ? 'superuser' : 'user';

    // Create new profile
    return await upsertUserProfile({
      user_id: userId,
      email,
      role,
      is_banned: false,
    });
  } catch (error) {
    console.error('Error initializing user profile:', error);
    return null;
  }
}

