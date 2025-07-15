export interface Card {
  id: string;
  front: string; // Arabic
  back: {
    bangla: string;
    english: string;
  };
  fsrsData: {
    due: Date;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: number;
    last_review?: Date;
  };
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  author: string;
  dailyNewLimit: number;
  groupAccessEnabled: boolean;
  isPublic: boolean;
  cards: Card[];
  stats: {
    total: number;
    new: number;
    learning: number;
    review: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DeckDisplayInfo {
  id: string;
  title: string;
  description: string;
  author: string;
  dailyNewLimit: number;
  groupAccessEnabled: boolean;
  isPublic: boolean;
  stats: {
    total: number;
    new: number;
    learning: number;
    review: number;
  };
  nextReviewTime: Date | null;
  nextReviewCount: number;
  cards: Card[];
}

export interface StudySession {
  deckId: string;
  cards: Card[];
  currentIndex: number;
  completed: boolean;
}

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export interface DeckUserAccess {
  id: string;
  deckId: string;
  userId: string;
  grantedBy: string;
  grantedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSelectionItem {
  id: string;
  userId: string;
  email: string;
  role: 'user' | 'admin' | 'superuser';
  hasAccess: boolean;
  createdAt: Date;
}