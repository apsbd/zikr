import { supabase, type DbDeck, type DbCard } from './supabase';
import { initializeFSRSCard, getCardStats } from './fsrs';
import type { Deck, Card, DeckDisplayInfo, DeckUserAccess, UserSelectionItem } from '@/types';
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
        fsrsData = initializeFSRSCard();
      } else if (progressArray && progressArray.length > 0) {
        const progress = progressArray[0]; // Take the first (should be only) result
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
    groupAccessEnabled: (dbDeck as any).group_access_enabled ?? false,
    isPublic: (dbDeck as any).is_public ?? true,
    cards,
    stats: getCardStats(cards),
    createdAt: new Date(dbDeck.created_at),
    updatedAt: new Date(dbDeck.updated_at),
  };
}

// Get deck metadata using local storage for progress (fast and accurate)
export async function getDeckMetadataLocal(userId?: string): Promise<DeckDisplayInfo[]> {
  if (!userId) return [];
  
  const { localStorageService } = await import('./local-storage');
  
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
    
    if (!decks || decks.length === 0) {
      return [];
    }

    // Get all progress from local storage
    const allProgress = new Map(); // Use empty map as this function is deprecated
    
    // Get card counts for each deck
    const deckMetadata: DeckDisplayInfo[] = await Promise.all(
      decks.map(async (deck) => {
        // Get card count for this deck
        const { count: totalCards, error: countError } = await supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('deck_id', deck.id);

        if (countError) {
          console.error('Error fetching card count:', countError);
        }

        // Get cards for this deck to analyze progress
        const { data: deckCards } = await supabase
          .from('cards')
          .select('id')
          .eq('deck_id', deck.id);

        // Calculate statistics based on local progress
        let newCards = 0;
        let learningCards = 0;
        let reviewCards = 0;
        let actualDueCards = 0;
        
        const now = new Date();
        
        if (deckCards) {
          deckCards.forEach(card => {
            const progress = allProgress.get(card.id);
            
            if (!progress) {
              // No progress = new card
              newCards++;
              // New cards are due (up to daily limit)
              if (newCards <= (deck.daily_new_limit || 20)) {
                actualDueCards++;
              }
            } else {
              // Has progress, check state
              switch (progress.state) {
                case 0:
                  newCards++;
                  if (progress.due <= now) actualDueCards++;
                  break;
                case 1:
                case 3:
                  learningCards++;
                  if (progress.due <= now) actualDueCards++;
                  break;
                case 2:
                  reviewCards++;
                  if (progress.due <= now) actualDueCards++;
                  break;
              }
            }
          });
        }

        return {
          id: deck.id,
          title: deck.title,
          description: deck.description || '',
          author: deck.author,
          dailyNewLimit: deck.daily_new_limit || 20,
          groupAccessEnabled: (deck as any).group_access_enabled ?? false,
          isPublic: (deck as any).is_public ?? true,
          stats: {
            total: totalCards || 0,
            new: newCards,
            learning: learningCards,
            review: reviewCards,
          },
          nextReviewTime: actualDueCards > 0 ? new Date() : null,
          nextReviewCount: actualDueCards,
          cards: [], // Empty - cards loaded on demand
        };
      })
    );

    return deckMetadata;
  } catch (error) {
    console.error('Error in getDeckMetadataLocal:', error);
    return [];
  }
}

// Filter decks based on access control
async function filterAccessibleDecks(decks: any[], userId?: string): Promise<any[]> {
  if (!userId) {
    // For unauthenticated users, only return public decks
    return decks.filter(deck => 
      deck.is_public === true && deck.group_access_enabled === false
    );
  }

  try {
    // Check if user is admin or superuser (both can see all decks)
    const isAdmin = await isUserAdmin(userId); // This includes both admin and superuser roles
    if (isAdmin) {
      return decks; // Admins and superusers see everything
    }

    // For regular users only, filter based on access rules
    const accessibleDecks = [];
    
    for (const deck of decks) {
      const isPublic = deck.is_public ?? true;
      const groupAccessEnabled = deck.group_access_enabled ?? false;
      
      if (isPublic && !groupAccessEnabled) {
        // Public deck without group access control - accessible to all
        accessibleDecks.push(deck);
      } else if (groupAccessEnabled) {
        // Group access enabled - check if user has explicit access
        const { data: accessData, error } = await supabase
          .from('deck_user_access')
          .select('user_id')
          .eq('deck_id', deck.id)
          .eq('user_id', userId)
          .single();
        
        if (!error && accessData) {
          accessibleDecks.push(deck);
        }
        // If no access found and group access is enabled, deck is not accessible
      }
      // If deck is not public and no group access enabled, it's not accessible to regular users
    }
    
    return accessibleDecks;
  } catch (error) {
    console.error('Error filtering accessible decks:', error);
    // On error, return only public decks without group access as fallback
    return decks.filter(deck => 
      deck.is_public === true && deck.group_access_enabled === false
    );
  }
}

// Check access to a single deck
async function checkSingleDeckAccess(deck: any, userId?: string): Promise<boolean> {
  if (!userId) {
    // For unauthenticated users, only public decks without group access
    return deck.is_public === true && deck.group_access_enabled === false;
  }

  try {
    // Check if user is admin or superuser (both can access all decks)
    const isAdmin = await isUserAdmin(userId); // This includes both admin and superuser roles
    if (isAdmin) {
      return true; // Admins and superusers can access everything
    }

    const isPublic = deck.is_public ?? true;
    const groupAccessEnabled = deck.group_access_enabled ?? false;
    
    if (isPublic && !groupAccessEnabled) {
      // Public deck without group access control - accessible to all
      return true;
    } else if (groupAccessEnabled) {
      // Group access enabled - check if user has explicit access
      const { data: accessData, error } = await supabase
        .from('deck_user_access')
        .select('user_id')
        .eq('deck_id', deck.id)
        .eq('user_id', userId)
        .single();
      
      return !error && !!accessData;
    }
    
    // If deck is not public and no group access enabled, not accessible
    return false;
  } catch (error) {
    console.error('Error checking single deck access:', error);
    // On error, only allow public decks without group access as fallback
    return deck.is_public === true && deck.group_access_enabled === false;
  }
}

// Get deck metadata only (without cards) for dashboard - OLD VERSION
export async function getDeckMetadata(userId?: string): Promise<DeckDisplayInfo[]> {
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
    
    if (!decks || decks.length === 0) {
      return [];
    }

    // Filter decks based on access control
    const accessibleDecks = await filterAccessibleDecks(decks, userId);

    // Get card counts for each deck (much faster than loading all cards)
    const deckMetadata: DeckDisplayInfo[] = await Promise.all(
      accessibleDecks.map(async (deck) => {
        // Get basic card stats without loading all card content
        const { count: totalCards, error: countError } = await supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('deck_id', deck.id);

        if (countError) {
          console.error('Error fetching card count:', countError);
        }

        // Get user progress stats if userId is provided
        let progressedNewCards = 0;
        let learningCards = 0;
        let reviewCards = 0;

        if (userId && totalCards && totalCards > 0) {
          // First get card IDs for this deck
          const { data: cardIds, error: cardIdsError } = await supabase
            .from('cards')
            .select('id')
            .eq('deck_id', deck.id);
          
          if (!cardIdsError && cardIds && cardIds.length > 0) {
            // Get user progress for this deck
            const { data: progressData, error: progressError } = await supabase
              .from('user_progress')
              .select('state')
              .eq('user_id', userId)
              .in('card_id', cardIds.map(card => card.id));

            if (!progressError && progressData) {
              // Count cards by state (0 = New, 1 = Learning, 2 = Review, 3 = Relearning)
              progressData.forEach(progress => {
                switch (progress.state) {
                  case 0:
                    progressedNewCards++;
                    break;
                  case 1:
                  case 3:
                    learningCards++;
                    break;
                  case 2:
                    reviewCards++;
                    break;
                }
              });
            }
          }
        }
        
        // Calculate new cards = cards without progress + cards with new state
        const cardsWithProgress = progressedNewCards + learningCards + reviewCards;
        const cardsWithoutProgress = Math.max(0, (totalCards || 0) - cardsWithProgress);
        const totalNewCards = cardsWithoutProgress + progressedNewCards;

        // Calculate cards actually due for study (check due dates)
        let actualDueCards = 0;
        const now = new Date();
        
        // Always start with new cards up to daily limit
        actualDueCards = Math.min(totalNewCards, deck.daily_new_limit || 20);
        
        // Add cards that are actually due now (not just in learning/review state)
        if (userId && (learningCards > 0 || reviewCards > 0)) {
          const { data: cardIds, error: cardIdsError } = await supabase
            .from('cards')
            .select('id')
            .eq('deck_id', deck.id);
            
          if (!cardIdsError && cardIds && cardIds.length > 0) {
            const { data: dueProgress } = await supabase
              .from('user_progress')
              .select('due')
              .eq('user_id', userId)
              .in('card_id', cardIds.map(card => card.id))
              .lte('due', now.toISOString());
            
            actualDueCards += (dueProgress?.length || 0);
          }
        }
        
        const nextReviewTime = actualDueCards > 0 ? new Date() : null;

        return {
          id: deck.id,
          title: deck.title,
          description: deck.description || '',
          author: deck.author,
          dailyNewLimit: deck.daily_new_limit || 20,
          groupAccessEnabled: (deck as any).group_access_enabled ?? false,
          isPublic: (deck as any).is_public ?? true,
          stats: {
            total: totalCards || 0,
            new: totalNewCards,
            learning: learningCards,
            review: reviewCards,
          },
          nextReviewTime,
          nextReviewCount: actualDueCards,
          cards: [], // Empty - cards loaded on demand
        };
      })
    );

    return deckMetadata;
  } catch (error) {
    console.error('Error in getDeckMetadata:', error);
    return [];
  }
}

// Get all decks from Supabase with access control (with cards - for backwards compatibility)
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

    // For now, disable access control to fix loading issue
    // TODO: Re-enable once database schema is updated
    const accessibleDecks = decks;
    
    // Filter decks based on access control (commented out until DB is updated)
    // let accessibleDecks = decks;
    
    // if (userId) {
    //   // Check if user is admin - admins see all decks
    //   const isAdmin = await isUserAdmin(userId);
      
    //   if (!isAdmin) {
    //     // Filter decks for regular users
    //     accessibleDecks = await Promise.all(
    //       decks.map(async deck => {
    //         const hasAccess = await checkDeckAccess(deck.id, userId);
    //         return hasAccess ? deck : null;
    //       })
    //     ).then(results => results.filter(deck => deck !== null));
    //   }
    // }

    // Group cards by deck_id and convert to app format
    const decksWithCards: Deck[] = await Promise.all(accessibleDecks.map(async deck => {
      const deckCards = cards.filter(card => card.deck_id === deck.id);
      return await dbDeckToAppDeck(deck, deckCards, userId);
    }));

    return decksWithCards;
  } catch (error) {
    console.error('Error in getDecks:', error);
    return [];
  }
}

// Get cards for a specific deck (for lazy loading)
export async function getDeckCards(deckId: string, userId?: string): Promise<Card[]> {
  try {
    // First check if user has access to this deck
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .select('*')
      .eq('id', deckId)
      .single();

    if (deckError || !deck) {
      return [];
    }

    const hasAccess = await checkSingleDeckAccess(deck, userId);
    if (!hasAccess) {
      return [];
    }

    // Fetch cards for this deck
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      return [];
    }

    // Convert to app format with user progress
    const appCards: Card[] = await Promise.all((cards || []).map(async dbCard => {
      let fsrsData;
      
      if (userId) {
        // Get user progress from database
        const { data: progressArray, error } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('card_id', dbCard.id);
        
        if (error) {
          fsrsData = initializeFSRSCard();
        } else if (progressArray && progressArray.length > 0) {
          const progress = progressArray[0];
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

    return appCards;
  } catch (error) {
    console.error('Error in getDeckCards:', error);
    return [];
  }
}

// Get all user progress for a user
export async function getUserProgress(userId: string): Promise<Map<string, any>> {
  try {
    const { data: progressData, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user progress:', error);
      return new Map();
    }

    const progressMap = new Map();
    (progressData || []).forEach(progress => {
      progressMap.set(progress.card_id, {
        state: progress.state,
        difficulty: progress.difficulty,
        stability: progress.stability,
        due: new Date(progress.due),
        elapsed_days: progress.elapsed_days,
        scheduled_days: progress.scheduled_days,
        reps: progress.reps,
        lapses: progress.lapses,
        last_review: progress.last_review ? new Date(progress.last_review) : undefined,
      });
    });

    return progressMap;
  } catch (error) {
    console.error('Error in getUserProgress:', error);
    return new Map();
  }
}

// Get cards for study session using local storage progress (fast and accurate)
export async function getStudyCardsLocal(deckId: string, userId?: string): Promise<Card[]> {
  if (!userId) return [];
  
  const { localStorageService } = await import('./local-storage');
  
  try {
    // Get deck info to get daily new limit
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .select('daily_new_limit')
      .eq('id', deckId)
      .single();

    if (deckError) {
      console.error('Error fetching deck:', deckError);
      return [];
    }

    const dailyNewLimit = deck?.daily_new_limit || 20;

    // Get all cards for this deck
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      return [];
    }

    if (!cards || cards.length === 0) {
      return [];
    }

    // Use new localStorage service to get study cards
    return localStorageService.getStudyCards(deckId, userId);
  } catch (error) {
    console.error('Error in getStudyCardsLocal:', error);
    return [];
  }
}

// Get cards for study session (only due cards + limited new cards) - OLD VERSION
export async function getStudyCards(deckId: string, userId?: string): Promise<Card[]> {
  try {
    // Get deck info to get daily new limit
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .select('daily_new_limit')
      .eq('id', deckId)
      .single();

    if (deckError) {
      console.error('Error fetching deck:', deckError);
      return [];
    }

    const dailyNewLimit = deck?.daily_new_limit || 20;

    // Get all cards for this deck
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      return [];
    }

    if (!cards || cards.length === 0) {
      return [];
    }

    // Get user progress for these cards
    const cardIds = cards.map(card => card.id);
    const { data: progressData, error: progressError } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .in('card_id', cardIds);

    if (progressError) {
      console.error('Error fetching progress:', progressError);
    }

    // Create a map of card progress
    const progressMap = new Map();
    (progressData || []).forEach(progress => {
      progressMap.set(progress.card_id, progress);
    });

    // Convert to app format and filter for study
    const now = new Date();
    const studyCards: Card[] = [];
    const newCards: Card[] = [];

    for (const dbCard of cards) {
      const progress = progressMap.get(dbCard.id);
      let fsrsData;

      if (progress) {
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
        fsrsData = initializeFSRSCard();
      }

      const card: Card = {
        id: dbCard.id,
        front: dbCard.front,
        back: {
          bangla: dbCard.back_bangla,
          english: dbCard.back_english,
        },
        fsrsData,
      };

      // If card is due for review, add it to study cards
      if (fsrsData.due <= now) {
        if (fsrsData.state === 0) { // New card
          newCards.push(card);
        } else {
          studyCards.push(card); // Review card
        }
      }
    }

    // Limit new cards to daily limit
    const limitedNewCards = newCards.slice(0, dailyNewLimit);
    
    // Return review cards + limited new cards
    return [...studyCards, ...limitedNewCards];
  } catch (error) {
    console.error('Error in getStudyCards:', error);
    return [];
  }
}

// Get a specific deck by ID with access control
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

    // Check access control
    const hasAccess = await checkSingleDeckAccess(deck, userId);
    if (!hasAccess) {
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
      group_access_enabled: deck.groupAccessEnabled ?? false,
      is_public: deck.isPublic ?? true,
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

    // Update existing cards only if they have changed
    if (existingCardsToUpdate.length > 0) {
      // First, get the current card data from the database
      const { data: currentCards, error: currentCardsError } = await supabase
        .from('cards')
        .select('*')
        .in('id', existingCardsToUpdate.map(card => card.id));

      if (currentCardsError) {
        console.error('Error fetching current cards:', currentCardsError);
        return false;
      }

      // Only update cards that have actually changed
      const cardsToUpdate = existingCardsToUpdate.filter(card => {
        const currentCard = currentCards?.find(c => c.id === card.id);
        if (!currentCard) return true; // If we can't find it, update it

        // Check if any field has changed
        return (
          currentCard.front !== card.front ||
          currentCard.back_bangla !== card.back.bangla ||
          currentCard.back_english !== card.back.english
        );
      });


      // Update only the cards that have changed
      for (const card of cardsToUpdate) {
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
        const { error } = await supabase
          .from('user_progress')
          .update(progressData)
          .eq('user_id', userId)
          .eq('card_id', cardId);
        
        if (error) {
          console.error('Error updating user progress:', error);
        } else {
        }
      } else {
        const { error } = await supabase
          .from('user_progress')
          .insert({ ...progressData, created_at: new Date().toISOString() });
        
        if (error) {
          console.error('Error inserting user progress:', error);
        } else {
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
    groupAccessEnabled: deck.groupAccessEnabled ?? false,
    isPublic: deck.isPublic ?? true,
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
    // Check if we're offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('Offline: Attempting to get user profile from offline storage');
      
      try {
        const { offlineService } = await import('./offline');
        const offlineProfile = await offlineService.getUserProfile(userId);
        if (offlineProfile) {
          return offlineProfile;
        }
      } catch (error) {
        console.log('Could not retrieve offline profile:', error);
      }
      
      // Return null if offline and no cached profile
      return null;
    }
    
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
      
      // If profile doesn't exist, try to get user email and create profile
      if (error.code === 'PGRST116') { // Row not found
        console.log('Profile not found, attempting to get user email for creation');
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id === userId) {
          console.log('Creating profile for user:', user.email);
          return await initializeUserProfile(userId, user.email || '');
        }
      }
      
      return null;
    }

    
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
    
    // First get current user info
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    // Get current user's profile to check role
    if (currentUser) {
      const currentProfile = await getUserProfile(currentUser.id);
    }
    
    // First check if the table exists and what columns it has
    const { data: tableInfo, error: tableError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);
    
    
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

    
    if (data) {
      data.forEach((profile, index) => {
      });
    }
    
    // Handle missing is_banned field for backward compatibility
    const profiles = (data || []).map(profile => ({
      ...profile,
      is_banned: profile.is_banned ?? false
    }));

    return profiles;
  } catch (error) {
    console.error('Error in getAllUserProfiles:', error);
    console.error('Error stack:', (error as Error).stack);
    return [];
  }
}

// Get all authenticated users who might not have profiles yet
export async function getAllAuthenticatedUsers(): Promise<any[]> {
  try {
    
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
    
    // Try to get raw count first
    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });
    
    
    // Try to get count using our function
    const { data: countData, error: countFnError } = await supabase
      .rpc('get_user_profiles_count');
    
    
    // Try to get data with RLS bypass (this might fail)
    const { data: rawData, error: rawError } = await supabase
      .rpc('get_all_user_profiles_debug');
    
    
    return { count, countError, countData, countFnError, rawData, rawError };
  } catch (error) {
    console.error('DEBUG: Error in debugGetAllUserProfiles:', error);
    return { error };
  }
}

// Helper function to get all authenticated users (for debugging)
export async function getAllAuthUsers() {
  try {
    
    // Note: This requires admin privileges and may not work in client-side code
    // This is mainly for debugging to see if there are auth users without profiles
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error fetching auth users:', error);
      return [];
    }

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
    // Check if we're offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('Offline: Checking admin status from offline storage');
      
      try {
        const { offlineService } = await import('./offline');
        const offlineProfile = await offlineService.getUserProfile(userId);
        if (offlineProfile) {
          const isAdmin = offlineProfile.role === 'admin' || offlineProfile.role === 'superuser';
          return isAdmin;
        }
      } catch (error) {
        console.log('Could not check offline admin status:', error);
      }
      
      // Default to false if offline and no cached profile
      return false;
    }
    
    // For server-side, query database directly instead of using getUserProfile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !profile) {
      console.log('isUserAdmin: No profile found for userId:', userId, error);
      return false;
    }
    
    console.log('isUserAdmin: Profile found:', { email: profile.email, role: profile.role });
    const isAdmin = profile.role === 'admin' || profile.role === 'superuser';
    console.log('isUserAdmin: Result:', isAdmin);
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Check if user is superuser
export async function isUserSuperuser(userId: string): Promise<boolean> {
  try {
    // For server-side, query database directly
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !profile) {
      console.log('No profile found for user:', userId, error);
      return false;
    }
    
    console.log('User profile role:', profile.role, 'for user:', profile.email);
    const isSuperuser = profile.role === 'superuser';
    return isSuperuser;
  } catch (error) {
    console.error('Error checking superuser status:', error);
    return false;
  }
}


// Initialize user profile on first login
export async function initializeUserProfile(userId: string, email: string): Promise<UserProfile | null> {
  try {
    // Check if we're offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('Offline: Skipping user profile initialization');
      
      // Try to get profile from offline storage
      try {
        const { offlineService } = await import('./offline');
        const offlineProfile = await offlineService.getUserProfile(userId);
        if (offlineProfile) {
          return offlineProfile;
        }
      } catch (error) {
        console.log('Could not retrieve offline profile:', error);
      }
      
      // Return a minimal profile object to prevent errors
      return {
        id: userId,
        user_id: userId,
        email,
        role: email === 'mohiuddin.007@gmail.com' ? 'superuser' : 'user',
        is_banned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as UserProfile;
    }

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

// Deck Access Management Functions

// Get users for deck access selection with pagination and search
export async function getUsersForDeckAccess(
  deckId: string,
  search: string = '',
  page: number = 1,
  pageSize: number = 10
): Promise<{ users: UserSelectionItem[], total: number }> {
  try {
    
    // Get all user profiles with optional search
    let query = supabase
      .from('user_profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    
    // Add search filter if provided
    if (search.trim()) {
      query = query.ilike('email', `%${search.trim()}%`);
    }
    
    // Add pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);
    
    const { data: profiles, error: profilesError, count } = await query;
    
    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError);
      return { users: [], total: 0 };
    }
    
    // Get current deck access for these users
    const userIds = profiles?.map(p => p.user_id) || [];
    const { data: accessData, error: accessError } = await supabase
      .from('deck_user_access')
      .select('user_id')
      .eq('deck_id', deckId)
      .in('user_id', userIds);
    
    if (accessError) {
      console.error('Error fetching deck access:', accessError);
    }
    
    const usersWithAccess = new Set(accessData?.map(a => a.user_id) || []);
    
    // Transform to UserSelectionItem format
    const users: UserSelectionItem[] = (profiles || []).map(profile => ({
      id: profile.id,
      userId: profile.user_id,
      email: profile.email,
      role: profile.role,
      hasAccess: usersWithAccess.has(profile.user_id),
      createdAt: new Date(profile.created_at),
    }));
    
    return { users, total: count || 0 };
  } catch (error) {
    console.error('Error in getUsersForDeckAccess:', error);
    return { users: [], total: 0 };
  }
}

// Grant deck access to a user
export async function grantDeckAccess(deckId: string, userId: string, grantedBy: string): Promise<boolean> {
  try {
    
    const { error } = await supabase
      .from('deck_user_access')
      .insert({
        deck_id: deckId,
        user_id: userId,
        granted_by: grantedBy,
      });
    
    if (error) {
      console.error('Error granting deck access:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in grantDeckAccess:', error);
    return false;
  }
}

// Revoke deck access from a user
export async function revokeDeckAccess(deckId: string, userId: string): Promise<boolean> {
  try {
    
    const { error } = await supabase
      .from('deck_user_access')
      .delete()
      .eq('deck_id', deckId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error revoking deck access:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in revokeDeckAccess:', error);
    return false;
  }
}

// Get deck access list for a specific deck
export async function getDeckAccessList(deckId: string): Promise<DeckUserAccess[]> {
  try {
    const { data, error } = await supabase
      .from('deck_user_access')
      .select(`
        *,
        user_profiles!deck_user_access_user_id_fkey(email, role)
      `)
      .eq('deck_id', deckId)
      .order('granted_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching deck access list:', error);
      return [];
    }
    
    return (data || []).map(access => ({
      id: access.id,
      deckId: access.deck_id,
      userId: access.user_id,
      grantedBy: access.granted_by,
      grantedAt: new Date(access.granted_at),
      createdAt: new Date(access.created_at),
      updatedAt: new Date(access.updated_at),
    }));
  } catch (error) {
    console.error('Error in getDeckAccessList:', error);
    return [];
  }
}

// Check if user has access to a deck
export async function checkDeckAccess(deckId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('user_has_deck_access', {
        user_uuid: userId,
        deck_uuid: deckId
      });
    
    if (error) {
      console.error('Error checking deck access:', error);
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.error('Error in checkDeckAccess:', error);
    return false;
  }
}
