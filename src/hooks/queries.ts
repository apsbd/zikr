'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { 
    getDecks, 
    getDeckById, 
    saveCardProgress, 
    saveDeck, 
    deleteDeck, 
    getDeckDisplayInfo 
} from '@/lib/database';
import { Deck, Card } from '@/types';

export const QUERY_KEYS = {
    DECKS: 'decks',
    DECK: 'deck',
    DECK_DISPLAY: 'deck-display',
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

export function useDeck(deckId: string | undefined) {
    const { user } = useAuth();
    
    return useQuery({
        queryKey: [QUERY_KEYS.DECK, deckId, user?.id],
        queryFn: () => getDeckById(deckId!, user?.id),
        enabled: !!deckId && !!user,
        staleTime: 30 * 1000, // 30 seconds (study sessions need fresh data)
        refetchOnWindowFocus: true,
    });
}

export function useDeckDisplay() {
    const { user } = useAuth();
    
    return useQuery({
        queryKey: [QUERY_KEYS.DECK_DISPLAY, user?.id],
        queryFn: async () => {
            const decks = await getDecks(user?.id);
            return decks.map(deck => getDeckDisplayInfo(deck));
        },
        enabled: !!user,
        staleTime: 1 * 60 * 1000, // 1 minute
        refetchOnWindowFocus: true,
        refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
    });
}

export function useCardProgressMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    
    return useMutation({
        mutationFn: ({ cardId, fsrsData }: { cardId: string; fsrsData: any }) => 
            saveCardProgress(cardId, fsrsData, user?.id),
        onSuccess: (_, { cardId }) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.DECKS, user?.id],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.DECK_DISPLAY, user?.id],
            });
            
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const [key, deckId] = query.queryKey;
                    return key === QUERY_KEYS.DECK;
                }
            });
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