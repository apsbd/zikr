'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Deck, Card as CardType } from '@/types';
import {
    getDeckById,
    saveDeck,
    initializeUserProfile,
    isUserAdmin
} from '@/lib/database';
import { initializeFSRSCard, getCardStats } from '@/lib/fsrs';
import {
    ArrowLeft,
    Plus,
    Edit,
    Trash2,
    Save,
    Upload,
    Search,
    X
} from 'lucide-react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfile from '@/components/Auth/UserProfile';
import { useAuth } from '@/contexts/auth';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function EditDeck() {
    const router = useRouter();
    const params = useParams();
    const deckId = params.id as string;
    const { user, loading } = useAuth();

    const [deck, setDeck] = useState<Deck | null>(null);
    const [editingCard, setEditingCard] = useState<CardType | null>(null);
    const [newCard, setNewCard] = useState({
        front: '',
        bangla: '',
        english: ''
    });
    const [isUploadingCSV, setIsUploadingCSV] = useState(false);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [errors, setErrors] = useState({
        front: '',
        bangla: '',
        english: ''
    });
    const [deckMeta, setDeckMeta] = useState({
        title: '',
        author: '',
        description: ''
    });
    const [deckMetaErrors, setDeckMetaErrors] = useState({
        title: '',
        author: ''
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{
        type: 'success' | 'error';
        text: string;
    } | null>(null);

    useEffect(() => {
        // Wait for auth to load before checking
        if (loading || !user) return;

        const checkUserRole = async () => {
            try {
                // Initialize user profile if it doesn't exist
                await initializeUserProfile(user.id, user.email || '');

                // Check if user has admin privileges
                const adminStatus = await isUserAdmin(user.id);

                if (!adminStatus) {
                    router.push('/admin');
                    return;
                }

                setIsAuthenticated(true);
            } catch (error) {
                console.error('Error checking user role:', error);
                router.push('/admin');
            }
        };

        checkUserRole();
    }, [user, loading, router]);

    useEffect(() => {
        if (isAuthenticated) {
            const loadDeck = async () => {
                try {
                    // Admin should see all decks without user filtering
                    const savedDeck = await getDeckById(deckId);
                    if (savedDeck) {
                        setDeck(savedDeck);
                        setDeckMeta({
                            title: savedDeck.title,
                            author: savedDeck.author,
                            description: savedDeck.description
                        });
                    } else {
                        router.push('/admin');
                    }
                } catch (error) {
                    console.error('Error loading deck:', error);
                    router.push('/admin');
                }
            };
            loadDeck();
        }
    }, [isAuthenticated, deckId, router]);

    const validateDeckMeta = () => {
        const newErrors = {
            title: '',
            author: ''
        };

        if (!deckMeta.title.trim()) {
            newErrors.title = 'Deck title is required';
        }
        if (!deckMeta.author.trim()) {
            newErrors.author = 'Author name is required';
        }

        setDeckMetaErrors(newErrors);
        return !newErrors.title && !newErrors.author;
    };

    const handleSaveDeck = async () => {
        if (!deck) return;

        if (!validateDeckMeta()) {
            return;
        }

        // Clear previous messages
        setSaveMessage(null);

        const updatedDeck = {
            ...deck,
            title: deckMeta.title.trim(),
            author: deckMeta.author.trim(),
            description: deckMeta.description.trim(),
            stats: getCardStats(deck.cards),
            updatedAt: new Date()
        };

        const success = await saveDeck(updatedDeck);
        if (success) {
            setSaveMessage({
                type: 'success',
                text: 'Deck saved successfully!'
            });
            // Auto-clear success message after 3 seconds
            setTimeout(() => setSaveMessage(null), 3000);
        } else {
            setSaveMessage({
                type: 'error',
                text: 'Error saving deck. Please try again.'
            });
        }
    };

    const validateCard = () => {
        const newErrors = {
            front: '',
            bangla: '',
            english: ''
        };

        if (!newCard.front.trim()) {
            newErrors.front = 'Arabic text is required';
        }
        if (!newCard.bangla.trim()) {
            newErrors.bangla = 'Bangla translation is required';
        }
        if (!newCard.english.trim()) {
            newErrors.english = 'English translation is required';
        }

        setErrors(newErrors);
        return !newErrors.front && !newErrors.bangla && !newErrors.english;
    };

    const handleAddCard = () => {
        if (!deck) return;

        if (!validateCard()) {
            return;
        }

        const fsrsCard = initializeFSRSCard();
        const card: CardType = {
            id: crypto.randomUUID(),
            front: newCard.front.trim(),
            back: {
                bangla: newCard.bangla.trim(),
                english: newCard.english.trim()
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

        // Clear form only on successful add
        setNewCard({ front: '', bangla: '', english: '' });
        setErrors({ front: '', bangla: '', english: '' });
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

    const parseCSV = (
        text: string
    ): Array<{ arabic: string; bangla: string; english: string }> => {
        const lines = text.split('\n').filter((line) => line.trim());
        const cards: Array<{
            arabic: string;
            bangla: string;
            english: string;
        }> = [];

        // Skip header row if it exists
        const startIndex =
            lines[0].toLowerCase().includes('arabic') ||
            lines[0].toLowerCase().includes('bangla') ||
            lines[0].toLowerCase().includes('english')
                ? 1
                : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            // Simple CSV parsing - handles basic comma separation
            const columns = line
                .split(',')
                .map((col) => col.trim().replace(/^"|"$/g, ''));

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
                    id: crypto.randomUUID(),
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

    // Filter cards based on search query
    const filteredCards =
        deck?.cards.filter((card) => {
            if (!searchQuery.trim()) return true;

            const query = searchQuery.toLowerCase().trim();
            const arabic = card.front.toLowerCase();
            const bangla = card.back.bangla.toLowerCase();
            const english = card.back.english.toLowerCase();

            return (
                arabic.includes(query) ||
                bangla.includes(query) ||
                english.includes(query)
            );
        }) || [];

    // Helper function to highlight search terms in text
    const highlightSearchTerm = (text: string, searchTerm: string) => {
        if (!searchTerm.trim()) return text;

        const regex = new RegExp(
            `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
            'gi'
        );
        const parts = text.split(regex);

        return parts.map((part, index) =>
            regex.test(part) ? (
                <span
                    key={index}
                    className='bg-yellow-400 text-gray-900 px-1 rounded'>
                    {part}
                </span>
            ) : (
                part
            )
        );
    };

    if (loading || !isAuthenticated || !deck) {
        return (
            <div className='min-h-screen bg-background flex items-center justify-center'>
                <div className='text-foreground'>Loading...</div>
            </div>
        );
    }

    return (
        <ProtectedRoute>
            <UserProfile />
            <ScrollArea
                className='h-screen w-full'
                style={{ height: 'calc(100vh - 80px )' }}>
                <div className='min-h-screen p-4'>
                    <div className='max-w-4xl mx-auto'>
                        <header className='mb-8'>
                            <div className='flex items-center gap-4'>
                                <Button
                                    onClick={() => router.push('/admin')}
                                    variant='outline'>
                                    <ArrowLeft className='w-4 h-4 mr-2' />
                                    Back to Admin
                                </Button>
                                <div>
                                    <h1 className='text-3xl font-bold text-foreground'>
                                        Edit Deck
                                    </h1>
                                    <p className='text-muted-foreground'>
                                        Manage deck details and cards
                                    </p>
                                </div>
                            </div>
                        </header>

                        {/* Deck Metadata Section */}
                        <Card className='mb-6'>
                            <CardHeader>
                                <CardTitle>Deck Information</CardTitle>
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <div>
                                    <label className='text-sm text-muted-foreground mb-2 block'>
                                        Deck Title{' '}
                                        <span className='text-destructive'>
                                            *
                                        </span>
                                    </label>
                                    <input
                                        type='text'
                                        value={deckMeta.title}
                                        onChange={(e) => {
                                            setDeckMeta({
                                                ...deckMeta,
                                                title: e.target.value
                                            });
                                            if (
                                                deckMetaErrors.title &&
                                                e.target.value.trim()
                                            ) {
                                                setDeckMetaErrors({
                                                    ...deckMetaErrors,
                                                    title: ''
                                                });
                                            }
                                        }}
                                        placeholder='Enter deck title'
                                        className={`w-full p-3 bg-input border rounded-lg text-foreground placeholder-muted-foreground ${
                                            deckMetaErrors.title
                                                ? 'border-destructive'
                                                : 'border-border'
                                        }`}
                                    />
                                    {deckMetaErrors.title && (
                                        <p className='text-destructive text-sm mt-1'>
                                            {deckMetaErrors.title}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className='text-sm text-muted-foreground mb-2 block'>
                                        Author{' '}
                                        <span className='text-destructive'>
                                            *
                                        </span>
                                    </label>
                                    <input
                                        type='text'
                                        value={deckMeta.author}
                                        onChange={(e) => {
                                            setDeckMeta({
                                                ...deckMeta,
                                                author: e.target.value
                                            });
                                            if (
                                                deckMetaErrors.author &&
                                                e.target.value.trim()
                                            ) {
                                                setDeckMetaErrors({
                                                    ...deckMetaErrors,
                                                    author: ''
                                                });
                                            }
                                        }}
                                        placeholder='Enter author name'
                                        className={`w-full p-3 bg-input border rounded-lg text-foreground placeholder-muted-foreground ${
                                            deckMetaErrors.author
                                                ? 'border-destructive'
                                                : 'border-border'
                                        }`}
                                    />
                                    {deckMetaErrors.author && (
                                        <p className='text-destructive text-sm mt-1'>
                                            {deckMetaErrors.author}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className='text-sm text-muted-foreground mb-2 block'>
                                        Description
                                    </label>
                                    <textarea
                                        value={deckMeta.description}
                                        onChange={(e) => {
                                            setDeckMeta({
                                                ...deckMeta,
                                                description: e.target.value
                                            });
                                        }}
                                        placeholder='Enter deck description (optional)'
                                        rows={3}
                                        className='w-full p-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground resize-none'
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <div className='mb-6 flex gap-4'>
                            <Button
                                onClick={() => setIsUploadingCSV(true)}
                                variant='secondary'>
                                <Upload className='w-4 h-4 mr-2' />
                                Upload CSV
                            </Button>
                            <Button onClick={handleSaveDeck}>
                                <Save className='w-4 h-4 mr-2' />
                                Save Deck
                            </Button>
                        </div>

                        {/* Save Message */}
                        {saveMessage && (
                            <div
                                className={`mb-6 p-4 rounded-lg border ${
                                    saveMessage.type === 'success'
                                        ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                                        : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                                }`}>
                                {saveMessage.text}
                            </div>
                        )}

                        {/* Add Card Form - Always Visible */}
                        <Card className='mb-6'>
                            <CardHeader>
                                <CardTitle>Add New Card</CardTitle>
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <div>
                                    <label className='text-sm text-muted-foreground mb-2 block'>
                                        Arabic Text{' '}
                                        <span className='text-destructive'>
                                            *
                                        </span>
                                    </label>
                                    <input
                                        type='text'
                                        value={newCard.front}
                                        onChange={(e) => {
                                            setNewCard({
                                                ...newCard,
                                                front: e.target.value
                                            });
                                            if (
                                                errors.front &&
                                                e.target.value.trim()
                                            ) {
                                                setErrors({
                                                    ...errors,
                                                    front: ''
                                                });
                                            }
                                        }}
                                        placeholder='Enter Arabic text'
                                        className={`w-full p-3 bg-input border rounded-lg text-foreground placeholder-muted-foreground arabic-text ${
                                            errors.front
                                                ? 'border-destructive'
                                                : 'border-border'
                                        }`}
                                    />
                                    {errors.front && (
                                        <p className='text-destructive text-sm mt-1'>
                                            {errors.front}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className='text-sm text-muted-foreground mb-2 block'>
                                        Bangla Translation{' '}
                                        <span className='text-destructive'>
                                            *
                                        </span>
                                    </label>
                                    <input
                                        type='text'
                                        value={newCard.bangla}
                                        onChange={(e) => {
                                            setNewCard({
                                                ...newCard,
                                                bangla: e.target.value
                                            });
                                            if (
                                                errors.bangla &&
                                                e.target.value.trim()
                                            ) {
                                                setErrors({
                                                    ...errors,
                                                    bangla: ''
                                                });
                                            }
                                        }}
                                        placeholder='Enter Bangla translation'
                                        className={`w-full p-3 bg-input border rounded-lg text-foreground placeholder-muted-foreground ${
                                            errors.bangla
                                                ? 'border-destructive'
                                                : 'border-border'
                                        }`}
                                    />
                                    {errors.bangla && (
                                        <p className='text-destructive text-sm mt-1'>
                                            {errors.bangla}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className='text-sm text-muted-foreground mb-2 block'>
                                        English Translation{' '}
                                        <span className='text-destructive'>
                                            *
                                        </span>
                                    </label>
                                    <input
                                        type='text'
                                        value={newCard.english}
                                        onChange={(e) => {
                                            setNewCard({
                                                ...newCard,
                                                english: e.target.value
                                            });
                                            if (
                                                errors.english &&
                                                e.target.value.trim()
                                            ) {
                                                setErrors({
                                                    ...errors,
                                                    english: ''
                                                });
                                            }
                                        }}
                                        placeholder='Enter English translation'
                                        className={`w-full p-3 bg-input border rounded-lg text-foreground placeholder-muted-foreground ${
                                            errors.english
                                                ? 'border-destructive'
                                                : 'border-border'
                                        }`}
                                    />
                                    {errors.english && (
                                        <p className='text-destructive text-sm mt-1'>
                                            {errors.english}
                                        </p>
                                    )}
                                </div>
                                <div className='flex gap-2'>
                                    <Button
                                        onClick={handleAddCard}
                                        variant='secondary'>
                                        <Plus className='w-4 h-4 mr-2' />
                                        Add Card
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* CSV Upload Form */}
                        {isUploadingCSV && (
                            <Card className='mb-6'>
                                <CardHeader>
                                    <CardTitle>Upload CSV File</CardTitle>
                                </CardHeader>
                                <CardContent className='space-y-4'>
                                    <div className='text-sm text-muted-foreground'>
                                        <p className='mb-2'>
                                            Upload a CSV file with the following
                                            format:
                                        </p>
                                        <div className='bg-muted p-3 rounded-lg font-mono text-xs'>
                                            <div className='text-muted-foreground'>
                                                Arabic,Bangla,English
                                            </div>
                                            <div className='text-foreground'>
                                                كِتَابٌ,কিতাব,Book
                                                <br />
                                                قَلَمٌ,কলম,Pen
                                                <br />
                                                بَيْتٌ,ঘর,House
                                            </div>
                                        </div>
                                        <p className='mt-2 text-xs text-muted-foreground'>
                                            • Header row is optional
                                            <br />
                                            • Each row should have: Arabic,
                                            Bangla, English
                                            <br />• Use commas to separate
                                            columns
                                        </p>
                                    </div>

                                    <div>
                                        <label className='text-sm text-muted-foreground mb-2 block'>
                                            Select CSV File
                                        </label>
                                        <input
                                            type='file'
                                            accept='.csv'
                                            onChange={handleFileUpload}
                                            className='w-full p-3 bg-input border border-border rounded-lg text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90'
                                        />
                                    </div>

                                    {csvFile && (
                                        <div className='text-sm text-green-600'>
                                            Selected file: {csvFile.name} (
                                            {Math.round(csvFile.size / 1024)}{' '}
                                            KB)
                                        </div>
                                    )}

                                    <div className='flex gap-2'>
                                        <Button
                                            onClick={handleCSVUpload}
                                            disabled={!csvFile}
                                            variant='secondary'>
                                            <Upload className='w-4 h-4 mr-2' />
                                            Import Cards
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                setIsUploadingCSV(false);
                                                setCsvFile(null);
                                            }}
                                            variant='outline'>
                                            Cancel
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Search Cards */}
                        <div className='mb-6'>
                            <div className='relative'>
                                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5' />
                                <input
                                    type='text'
                                    placeholder='Search cards by Arabic, Bangla, or English...'
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    className='w-full pl-10 pr-12 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'>
                                        <X className='w-5 h-5' />
                                    </button>
                                )}
                            </div>
                            {searchQuery && (
                                <p className='text-sm text-muted-foreground mt-2'>
                                    Showing {filteredCards.length} of{' '}
                                    {deck.cards.length} cards
                                </p>
                            )}
                        </div>

                        {/* Cards List */}
                        <div className='space-y-4'>
                            {filteredCards.map((card) => (
                                <Card key={card.id}>
                                    <CardContent className='p-4'>
                                        {editingCard &&
                                        editingCard.id === card.id ? (
                                            <div className='space-y-4'>
                                                <div>
                                                    <label className='text-sm text-muted-foreground mb-2 block'>
                                                        Arabic Text
                                                    </label>
                                                    <input
                                                        type='text'
                                                        value={
                                                            editingCard.front
                                                        }
                                                        onChange={(e) =>
                                                            setEditingCard({
                                                                ...editingCard,
                                                                front: e.target
                                                                    .value
                                                            })
                                                        }
                                                        className='w-full p-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground'
                                                    />
                                                </div>
                                                <div>
                                                    <label className='text-sm text-muted-foreground mb-2 block'>
                                                        Bangla Translation
                                                    </label>
                                                    <input
                                                        type='text'
                                                        value={
                                                            editingCard.back
                                                                .bangla
                                                        }
                                                        onChange={(e) =>
                                                            setEditingCard({
                                                                ...editingCard,
                                                                back: {
                                                                    ...editingCard.back,
                                                                    bangla: e
                                                                        .target
                                                                        .value
                                                                }
                                                            })
                                                        }
                                                        className='w-full p-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground'
                                                    />
                                                </div>
                                                <div>
                                                    <label className='text-sm text-muted-foreground mb-2 block'>
                                                        English Translation
                                                    </label>
                                                    <input
                                                        type='text'
                                                        value={
                                                            editingCard.back
                                                                .english
                                                        }
                                                        onChange={(e) =>
                                                            setEditingCard({
                                                                ...editingCard,
                                                                back: {
                                                                    ...editingCard.back,
                                                                    english:
                                                                        e.target
                                                                            .value
                                                                }
                                                            })
                                                        }
                                                        className='w-full p-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground'
                                                    />
                                                </div>
                                                <div className='flex gap-2'>
                                                    <Button
                                                        onClick={
                                                            handleSaveCardEdit
                                                        }
                                                        variant='secondary'>
                                                        Save
                                                    </Button>
                                                    <Button
                                                        onClick={() =>
                                                            setEditingCard(null)
                                                        }
                                                        variant='outline'>
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className='flex items-center justify-between'>
                                                <div className='flex-1'>
                                                    <div className='text-foreground font-medium mb-1 arabic-text'>
                                                        {highlightSearchTerm(
                                                            card.front,
                                                            searchQuery
                                                        )}
                                                    </div>
                                                    <div className='text-muted-foreground text-sm'>
                                                        {highlightSearchTerm(
                                                            card.back.bangla,
                                                            searchQuery
                                                        )}{' '}
                                                        •{' '}
                                                        {highlightSearchTerm(
                                                            card.back.english,
                                                            searchQuery
                                                        )}
                                                    </div>
                                                </div>
                                                <div className='flex gap-2'>
                                                    <Button
                                                        onClick={() =>
                                                            handleEditCard(card)
                                                        }
                                                        size='sm'
                                                        variant='outline'>
                                                        <Edit className='w-4 h-4' />
                                                    </Button>
                                                    <Button
                                                        onClick={() =>
                                                            handleDeleteCard(
                                                                card.id
                                                            )
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
                                <p className='text-muted-foreground'>
                                    No cards in this deck. Add your first card!
                                </p>
                            </div>
                        )}

                        {deck.cards.length > 0 &&
                            filteredCards.length === 0 &&
                            searchQuery && (
                                <div className='text-center py-12'>
                                    <p className='text-muted-foreground'>
                                        No cards found matching "{searchQuery}"
                                    </p>
                                    <p className='text-sm text-muted-foreground mt-2'>
                                        Try searching for Arabic, Bangla, or
                                        English text
                                    </p>
                                </div>
                            )}
                    </div>
                </div>
            </ScrollArea>
        </ProtectedRoute>
    );
}
