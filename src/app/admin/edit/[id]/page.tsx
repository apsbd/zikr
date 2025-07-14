'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Deck, Card as CardType } from '@/types';
import { getDeckById, saveDeck } from '@/lib/data';
import { initializeFSRSCard, getCardStats } from '@/lib/fsrs';
import { ArrowLeft, Plus, Edit, Trash2, Save, Upload } from 'lucide-react';

export default function EditDeck() {
    const router = useRouter();
    const params = useParams();
    const deckId = params.id as string;

    const [deck, setDeck] = useState<Deck | null>(null);
    const [editingCard, setEditingCard] = useState<CardType | null>(null);
    const [newCard, setNewCard] = useState({
        front: '',
        bangla: '',
        english: ''
    });
    const [isAddingCard, setIsAddingCard] = useState(false);
    const [isUploadingCSV, setIsUploadingCSV] = useState(false);
    const [csvFile, setCsvFile] = useState<File | null>(null);

    useEffect(() => {
        const loadDeck = () => {
            const savedDeck = getDeckById(deckId);
            if (savedDeck) {
                setDeck(savedDeck);
            } else {
                router.push('/admin');
            }
        };
        loadDeck();
    }, [deckId, router]);

    const handleSaveDeck = () => {
        if (!deck) return;

        const updatedDeck = {
            ...deck,
            stats: getCardStats(deck.cards),
            updatedAt: new Date()
        };

        saveDeck(updatedDeck);
        router.push('/admin');
    };

    const handleAddCard = () => {
        if (!deck || !newCard.front || !newCard.bangla || !newCard.english)
            return;

        const fsrsCard = initializeFSRSCard();
        const card: CardType = {
            id: `card-${Date.now()}`,
            front: newCard.front,
            back: {
                bangla: newCard.bangla,
                english: newCard.english
            },
            fsrsData: {
                due: fsrsCard.due,
                stability: fsrsCard.stability,
                difficulty: fsrsCard.difficulty,
                elapsed_days: fsrsCard.elapsed_days,
                scheduled_days: fsrsCard.scheduled_days,
                reps: fsrsCard.reps,
                lapses: fsrsCard.lapses,
                state: fsrsCard.state,
                last_review: fsrsCard.last_review
            }
        };

        setDeck({
            ...deck,
            cards: [...deck.cards, card]
        });

        setNewCard({ front: '', bangla: '', english: '' });
        setIsAddingCard(false);
    };

    const handleDeleteCard = (cardId: string) => {
        if (!deck) return;
        if (confirm('Are you sure you want to delete this card?')) {
            setDeck({
                ...deck,
                cards: deck.cards.filter((card) => card.id !== cardId)
            });
        }
    };

    const handleEditCard = (card: CardType) => {
        setEditingCard(card);
    };

    const handleSaveCardEdit = () => {
        if (!deck || !editingCard) return;

        setDeck({
            ...deck,
            cards: deck.cards.map((card) =>
                card.id === editingCard.id ? editingCard : card
            )
        });

        setEditingCard(null);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'text/csv') {
            setCsvFile(file);
        } else {
            alert('Please select a valid CSV file');
        }
    };

    const parseCSV = (text: string): Array<{arabic: string, bangla: string, english: string}> => {
        const lines = text.split('\n').filter(line => line.trim());
        const cards: Array<{arabic: string, bangla: string, english: string}> = [];
        
        // Skip header row if it exists
        const startIndex = lines[0].toLowerCase().includes('arabic') || 
                          lines[0].toLowerCase().includes('bangla') || 
                          lines[0].toLowerCase().includes('english') ? 1 : 0;
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            // Simple CSV parsing - handles basic comma separation
            const columns = line.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
            
            if (columns.length >= 3) {
                cards.push({
                    arabic: columns[0],
                    bangla: columns[1],
                    english: columns[2]
                });
            }
        }
        
        return cards;
    };

    const handleCSVUpload = async () => {
        if (!csvFile || !deck) return;
        
        try {
            const text = await csvFile.text();
            const csvCards = parseCSV(text);
            
            if (csvCards.length === 0) {
                alert('No valid cards found in CSV file');
                return;
            }
            
            // Convert CSV data to Card objects
            const newCards: CardType[] = csvCards.map((csvCard, index) => {
                const fsrsCard = initializeFSRSCard();
                return {
                    id: `csv-card-${Date.now()}-${index}`,
                    front: csvCard.arabic,
                    back: {
                        bangla: csvCard.bangla,
                        english: csvCard.english
                    },
                    fsrsData: {
                        due: fsrsCard.due,
                        stability: fsrsCard.stability,
                        difficulty: fsrsCard.difficulty,
                        elapsed_days: fsrsCard.elapsed_days,
                        scheduled_days: fsrsCard.scheduled_days,
                        reps: fsrsCard.reps,
                        lapses: fsrsCard.lapses,
                        state: fsrsCard.state,
                        last_review: fsrsCard.last_review
                    }
                };
            });
            
            // Add new cards to deck
            setDeck({
                ...deck,
                cards: [...deck.cards, ...newCards]
            });
            
            // Reset CSV upload state
            setCsvFile(null);
            setIsUploadingCSV(false);
            
            alert(`Successfully imported ${newCards.length} cards from CSV`);
        } catch (error) {
            console.error('Error parsing CSV:', error);
            alert('Error parsing CSV file. Please check the format.');
        }
    };

    if (!deck) {
        return (
            <div className='min-h-screen bg-gray-900 flex items-center justify-center'>
                <div className='text-white'>Loading...</div>
            </div>
        );
    }

    return (
        <div className='min-h-screen bg-gray-900 p-4'>
            <div className='max-w-4xl mx-auto'>
                <header className='mb-8 flex items-center gap-4'>
                    <Button
                        onClick={() => router.push('/admin')}
                        variant='outline'
                        className='border-gray-600 text-gray-300 hover:bg-gray-800'>
                        <ArrowLeft className='w-4 h-4 mr-2' />
                        Back to Admin
                    </Button>
                    <div>
                        <h1 className='text-3xl font-bold text-white'>
                            {deck.title}
                        </h1>
                        <p className='text-gray-300'>{deck.description}</p>
                    </div>
                </header>

                <div className='mb-6 flex gap-4'>
                    <Button
                        onClick={() => setIsAddingCard(true)}
                        className='bg-green-600 hover:bg-green-700'>
                        <Plus className='w-4 h-4 mr-2' />
                        Add Card
                    </Button>
                    <Button
                        onClick={() => setIsUploadingCSV(true)}
                        className='bg-purple-600 hover:bg-purple-700'>
                        <Upload className='w-4 h-4 mr-2' />
                        Upload CSV
                    </Button>
                    <Button
                        onClick={handleSaveDeck}
                        className='bg-blue-600 hover:bg-blue-700'>
                        <Save className='w-4 h-4 mr-2' />
                        Save Deck
                    </Button>
                </div>

                {/* Add Card Form */}
                {isAddingCard && (
                    <Card className='mb-6 bg-gray-800 border-gray-700'>
                        <CardHeader>
                            <CardTitle className='text-white'>
                                Add New Card
                            </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            <div>
                                <label className='text-sm text-gray-300 mb-2 block'>
                                    Arabic Text
                                </label>
                                <input
                                    type='text'
                                    value={newCard.front}
                                    onChange={(e) =>
                                        setNewCard({
                                            ...newCard,
                                            front: e.target.value
                                        })
                                    }
                                    placeholder='Enter Arabic text'
                                    className='w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400'
                                />
                            </div>
                            <div>
                                <label className='text-sm text-gray-300 mb-2 block'>
                                    Bangla Translation
                                </label>
                                <input
                                    type='text'
                                    value={newCard.bangla}
                                    onChange={(e) =>
                                        setNewCard({
                                            ...newCard,
                                            bangla: e.target.value
                                        })
                                    }
                                    placeholder='Enter Bangla translation'
                                    className='w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400'
                                />
                            </div>
                            <div>
                                <label className='text-sm text-gray-300 mb-2 block'>
                                    English Translation
                                </label>
                                <input
                                    type='text'
                                    value={newCard.english}
                                    onChange={(e) =>
                                        setNewCard({
                                            ...newCard,
                                            english: e.target.value
                                        })
                                    }
                                    placeholder='Enter English translation'
                                    className='w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400'
                                />
                            </div>
                            <div className='flex gap-2'>
                                <Button
                                    onClick={handleAddCard}
                                    className='bg-green-600 hover:bg-green-700'>
                                    Add Card
                                </Button>
                                <Button
                                    onClick={() => setIsAddingCard(false)}
                                    variant='outline'
                                    className='border-gray-600 text-gray-300 hover:bg-gray-800'>
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* CSV Upload Form */}
                {isUploadingCSV && (
                    <Card className='mb-6 bg-gray-800 border-gray-700'>
                        <CardHeader>
                            <CardTitle className='text-white'>
                                Upload CSV File
                            </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            <div className='text-sm text-gray-300'>
                                <p className='mb-2'>
                                    Upload a CSV file with the following format:
                                </p>
                                <div className='bg-gray-700 p-3 rounded-lg font-mono text-xs'>
                                    <div className='text-gray-400'>
                                        Arabic,Bangla,English
                                    </div>
                                    <div className='text-white'>
                                        كِتَابٌ,কিতাব,Book
                                        <br />
                                        قَلَمٌ,কলম,Pen
                                        <br />
                                        بَيْتٌ,ঘর,House
                                    </div>
                                </div>
                                <p className='mt-2 text-xs text-gray-400'>
                                    • Header row is optional
                                    <br />
                                    • Each row should have: Arabic, Bangla, English
                                    <br />
                                    • Use commas to separate columns
                                </p>
                            </div>
                            
                            <div>
                                <label className='text-sm text-gray-300 mb-2 block'>
                                    Select CSV File
                                </label>
                                <input
                                    type='file'
                                    accept='.csv'
                                    onChange={handleFileUpload}
                                    className='w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700'
                                />
                            </div>
                            
                            {csvFile && (
                                <div className='text-sm text-green-400'>
                                    Selected file: {csvFile.name} ({Math.round(csvFile.size / 1024)} KB)
                                </div>
                            )}
                            
                            <div className='flex gap-2'>
                                <Button
                                    onClick={handleCSVUpload}
                                    disabled={!csvFile}
                                    className='bg-purple-600 hover:bg-purple-700 disabled:opacity-50'>
                                    <Upload className='w-4 h-4 mr-2' />
                                    Import Cards
                                </Button>
                                <Button
                                    onClick={() => {
                                        setIsUploadingCSV(false);
                                        setCsvFile(null);
                                    }}
                                    variant='outline'
                                    className='border-gray-600 text-gray-300 hover:bg-gray-800'>
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Cards List */}
                <div className='space-y-4'>
                    {deck.cards.map((card) => (
                        <Card
                            key={card.id}
                            className='bg-gray-800 border-gray-700'>
                            <CardContent className='p-4'>
                                {editingCard && editingCard.id === card.id ? (
                                    <div className='space-y-4'>
                                        <div>
                                            <label className='text-sm text-gray-300 mb-2 block'>
                                                Arabic Text
                                            </label>
                                            <input
                                                type='text'
                                                value={editingCard.front}
                                                onChange={(e) =>
                                                    setEditingCard({
                                                        ...editingCard,
                                                        front: e.target.value
                                                    })
                                                }
                                                className='w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400'
                                            />
                                        </div>
                                        <div>
                                            <label className='text-sm text-gray-300 mb-2 block'>
                                                Bangla Translation
                                            </label>
                                            <input
                                                type='text'
                                                value={editingCard.back.bangla}
                                                onChange={(e) =>
                                                    setEditingCard({
                                                        ...editingCard,
                                                        back: {
                                                            ...editingCard.back,
                                                            bangla: e.target
                                                                .value
                                                        }
                                                    })
                                                }
                                                className='w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400'
                                            />
                                        </div>
                                        <div>
                                            <label className='text-sm text-gray-300 mb-2 block'>
                                                English Translation
                                            </label>
                                            <input
                                                type='text'
                                                value={editingCard.back.english}
                                                onChange={(e) =>
                                                    setEditingCard({
                                                        ...editingCard,
                                                        back: {
                                                            ...editingCard.back,
                                                            english:
                                                                e.target.value
                                                        }
                                                    })
                                                }
                                                className='w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400'
                                            />
                                        </div>
                                        <div className='flex gap-2'>
                                            <Button
                                                onClick={handleSaveCardEdit}
                                                className='bg-green-600 hover:bg-green-700'>
                                                Save
                                            </Button>
                                            <Button
                                                onClick={() =>
                                                    setEditingCard(null)
                                                }
                                                variant='outline'
                                                className='border-gray-600 text-gray-300 hover:bg-gray-800'>
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className='flex items-center justify-between'>
                                        <div className='flex-1'>
                                            <div className='text-white font-medium mb-1 arabic-text-list'>
                                                {card.front}
                                            </div>
                                            <div className='text-gray-300 text-sm'>
                                                {card.back.bangla} •{' '}
                                                {card.back.english}
                                            </div>
                                        </div>
                                        <div className='flex gap-2'>
                                            <Button
                                                onClick={() =>
                                                    handleEditCard(card)
                                                }
                                                size='sm'
                                                variant='outline'
                                                className='border-gray-600 text-gray-300 hover:bg-gray-800'>
                                                <Edit className='w-4 h-4' />
                                            </Button>
                                            <Button
                                                onClick={() =>
                                                    handleDeleteCard(card.id)
                                                }
                                                size='sm'
                                                variant='destructive'>
                                                <Trash2 className='w-4 h-4' />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {deck.cards.length === 0 && (
                    <div className='text-center py-12'>
                        <p className='text-gray-400'>
                            No cards in this deck. Add your first card!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
