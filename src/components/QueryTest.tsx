'use client';

import { useDeckDisplay } from '@/hooks/queries';

export function QueryTest() {
    const { data, isLoading, error } = useDeckDisplay();

    if (isLoading) {
        return <div>Loading decks...</div>;
    }

    if (error) {
        return <div>Error: {error.message}</div>;
    }

    return (
        <div>
            <h3>Query Test Results:</h3>
            <p>Decks loaded: {data?.length || 0}</p>
            {data?.map(deck => (
                <div key={deck.id}>
                    <strong>{deck.title}</strong> - {deck.stats.total} cards
                </div>
            ))}
        </div>
    );
}