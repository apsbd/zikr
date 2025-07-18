import type { DeckDisplayInfo } from '@/types';
import type { DeckWithStats } from './types';

export function convertDeckDisplayInfoToDeckWithStats(
  deckDisplayInfo: DeckDisplayInfo
): DeckWithStats {
  return {
    id: deckDisplayInfo.id,
    title: deckDisplayInfo.title,
    description: deckDisplayInfo.description || '',
    author: deckDisplayInfo.author,
    daily_new_limit: deckDisplayInfo.dailyNewLimit || 20,
    group_access_enabled: deckDisplayInfo.groupAccessEnabled || false,
    is_public: deckDisplayInfo.isPublic !== false,
    user_id: undefined, // DeckDisplayInfo doesn't have userId
    created_at: new Date().toISOString(), // DeckDisplayInfo doesn't have createdAt
    updated_at: new Date().toISOString(), // DeckDisplayInfo doesn't have updatedAt
    
    // Stats fields
    card_count: deckDisplayInfo.stats.total || 0,
    new_count: deckDisplayInfo.stats.new || 0,
    learning_count: deckDisplayInfo.stats.learning || 0,
    review_count: deckDisplayInfo.stats.review || 0,
    total_studied: (deckDisplayInfo.stats.total - deckDisplayInfo.stats.new) || 0
  };
}

export function convertDeckWithStatsToDeckDisplayInfo(
  deckWithStats: DeckWithStats
): DeckDisplayInfo {
  return {
    id: deckWithStats.id,
    title: deckWithStats.title,
    description: deckWithStats.description || '',
    author: deckWithStats.author,
    dailyNewLimit: deckWithStats.daily_new_limit,
    groupAccessEnabled: deckWithStats.group_access_enabled,
    isPublic: deckWithStats.is_public,
    // Note: DeckDisplayInfo doesn't have userId, createdAt, updatedAt fields
    
    // Stats fields
    stats: {
      total: deckWithStats.card_count || 0,
      new: deckWithStats.new_count || 0,
      learning: deckWithStats.learning_count || 0,
      review: deckWithStats.review_count || 0
    },
    
    // Computed fields that may not exist in DeckWithStats
    nextReviewTime: null, // This would need to be computed separately
    nextReviewCount: 0,
    cards: [] // This would need to be populated separately
  };
}