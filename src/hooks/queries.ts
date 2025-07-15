'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { 
    getDecks, 
    getDeckById, 
    getDeckMetadata,
    getStudyCards,
    saveCardProgress, 
    saveDeck, 
    deleteDeck 
} from '@/lib/database';
import { getDeckDisplayInfo } from '@/lib/data';
import { Deck, Card } from '@/types';

export const QUERY_KEYS = {
    DECKS: 'decks',
    DECK: 'deck',
    DECK_DISPLAY: 'deck-display',
    STUDY_CARDS: 'study-cards',
} as const;

export function useDecks() {
    const { user } = useAuth();
    
    return useQuery({
        queryKey: [QUERY_KEYS.DECKS, user?.id],
        queryFn: () => getDecks(user?.id),
        enabled: !!user,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: true,
    });
}

export function useDeck(deckId: string | undefined, options?: { disableRefetch?: boolean }) {
    const { user } = useAuth();
    
    return useQuery({
        queryKey: [QUERY_KEYS.DECK, deckId, user?.id],
        queryFn: () => getDeckById(deckId!, user?.id),
        enabled: !!deckId && !!user,
        staleTime: 10 * 60 * 1000, // 10 minutes (longer for study sessions)
        refetchOnWindowFocus: options?.disableRefetch ? false : true,
        refetchInterval: options?.disableRefetch ? false : undefined,
    });
}

export function useDeckDisplay() {
    const { user } = useAuth();
    
    return useQuery({
        queryKey: [QUERY_KEYS.DECK_DISPLAY, user?.id],
        queryFn: () => getDeckMetadata(user?.id),
        enabled: !!user,
        staleTime: 30 * 1000, // 30 seconds - shorter for more frequent updates
        refetchOnWindowFocus: true,
        refetchInterval: 2 * 60 * 1000, // Auto-refetch every 2 minutes
    });
}

export function useCardProgressMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    
    return useMutation({
        mutationFn: ({ cardId, fsrsData }: { cardId: string; fsrsData: any }) => 
            saveCardProgress(cardId, fsrsData, user?.id),
        onSuccess: (_, { cardId }) => {
            console.log('Card progress saved for card:', cardId);
            
            // Invalidate dashboard queries to update progress
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.DECK_DISPLAY, user?.id],
            });
            
            // Also invalidate the new query system
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const [key] = query.queryKey;
                    return key === 'decks' && query.queryKey.includes('metadata');
                }
            });
            
            console.log('Dashboard queries invalidated after card progress update');
        },
    });
}

export function useStudySessionCompleteMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    
    return useMutation({
        mutationFn: async () => {
            // This is just a signal that the study session is complete
            return Promise.resolve();
        },
        onSuccess: () => {
            console.log('Study session completed - invalidating queries...');
            
            // Clear all deck-related cache completely
            queryClient.removeQueries({
                queryKey: [QUERY_KEYS.DECKS, user?.id],
            });
            queryClient.removeQueries({
                queryKey: [QUERY_KEYS.DECK_DISPLAY, user?.id],
            });
            queryClient.removeQueries({
                predicate: (query) => {
                    const [key] = query.queryKey;
                    return key === QUERY_KEYS.DECK || key === QUERY_KEYS.STUDY_CARDS;
                }
            });
            
            // Also clear the new query system cache
            queryClient.removeQueries({
                predicate: (query) => {
                    const [key] = query.queryKey;
                    return key === 'decks';
                }
            });
            
            console.log('Cache cleared - forcing fresh data fetch');
        },
    });
}

export function useSaveDeckMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    
    return useMutation({
        mutationFn: (deck: Deck) => saveDeck(deck),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.DECKS, user?.id],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.DECK_DISPLAY, user?.id],
            });
        },
    });
}

export function useDeleteDeckMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    
    return useMutation({
        mutationFn: (deckId: string) => deleteDeck(deckId),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.DECKS, user?.id],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.DECK_DISPLAY, user?.id],
            });
        },
    });
}

export function useStudyCards(deckId: string | undefined) {
    const { user } = useAuth();
    
    return useQuery({
        queryKey: [QUERY_KEYS.STUDY_CARDS, deckId, user?.id],
        queryFn: () => getStudyCards(deckId!, user?.id),
        enabled: !!deckId && !!user,
        staleTime: 1 * 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
    });
}

export function useUpdatePasswordMutation() {
    const { updatePassword } = useAuth();
    
    return useMutation({
        mutationFn: (newPassword: string) => updatePassword(newPassword),
        onSuccess: () => {
            // Password update successful - no additional invalidation needed
        },
    });
}