import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getDeckMetadata, 
  getDeckById, 
  getDeckCards, 
  getStudyCards, 
  saveDeck 
} from './database';
import type { Deck, Card, DeckDisplayInfo } from '@/types';

// Query keys
export const queryKeys = {
  decks: ['decks'] as const,
  deckMetadata: (userId?: string) => ['decks', 'metadata', userId] as const,
  deck: (id: string, userId?: string) => ['decks', id, userId] as const,
  deckCards: (deckId: string, userId?: string) => ['decks', deckId, 'cards', userId] as const,
  studyCards: (deckId: string, userId?: string) => 
    ['decks', deckId, 'study', userId] as const,
};

// Hook to get deck metadata for dashboard (fast loading)
export function useDeckMetadata(userId?: string) {
  return useQuery({
    queryKey: queryKeys.deckMetadata(userId),
    queryFn: () => getDeckMetadata(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook to get full deck with cards (lazy loaded)
export function useDeck(id: string, userId?: string) {
  return useQuery({
    queryKey: queryKeys.deck(id, userId),
    queryFn: () => getDeckById(id, userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
}

// Hook to get cards for a specific deck (lazy loaded)
export function useDeckCards(deckId: string, userId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.deckCards(deckId, userId),
    queryFn: () => getDeckCards(deckId, userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: enabled && !!deckId,
  });
}

// Hook to get study cards (optimized for study session)
export function useStudyCards(deckId: string, userId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.studyCards(deckId, userId),
    queryFn: () => getStudyCards(deckId, userId),
    staleTime: 30 * 1000, // 30 seconds (short for study sessions)
    gcTime: 2 * 60 * 1000, // 2 minutes
    enabled: enabled && !!deckId,
  });
}

// Hook to save/update deck
export function useSaveDeck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deck: Deck) => saveDeck(deck),
    onSuccess: (success, deck) => {
      if (success) {
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: queryKeys.decks });
        queryClient.invalidateQueries({ queryKey: queryKeys.deck(deck.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.deckCards(deck.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.studyCards(deck.id) });
      }
    },
  });
}

// Hook to prefetch deck cards (for better UX)
export function usePrefetchDeckCards() {
  const queryClient = useQueryClient();

  return (deckId: string, userId?: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.deckCards(deckId, userId),
      queryFn: () => getDeckCards(deckId, userId),
      staleTime: 2 * 60 * 1000,
    });
  };
}

// Hook to prefetch study cards (for better UX)
export function usePrefetchStudyCards() {
  const queryClient = useQueryClient();

  return (deckId: string, userId?: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.studyCards(deckId, userId),
      queryFn: () => getStudyCards(deckId, userId),
      staleTime: 30 * 1000,
    });
  };
}