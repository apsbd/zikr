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
  cards: Card[];
  stats: {
    total: number;
    new: number;
    learning: number;
    review: number;
  };
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