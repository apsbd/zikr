import { FSRS, Card as FSRSCard, Rating, State, Grade, createEmptyCard } from 'ts-fsrs';
import { Card, Rating as AppRating } from '@/types';

const fsrs = new FSRS({});

export function initializeFSRSCard() {
  const emptyCard = createEmptyCard();
  return {
    due: emptyCard.due,
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty,
    elapsed_days: emptyCard.elapsed_days,
    scheduled_days: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    state: emptyCard.state,
    last_review: emptyCard.last_review,
  };
}

export function reviewCard(card: Card, rating: AppRating): Card {
  const fsrsCard = createEmptyCard();
  fsrsCard.due = card.fsrsData.due;
  fsrsCard.stability = card.fsrsData.stability;
  fsrsCard.difficulty = card.fsrsData.difficulty;
  fsrsCard.elapsed_days = card.fsrsData.elapsed_days;
  fsrsCard.scheduled_days = card.fsrsData.scheduled_days;
  fsrsCard.reps = card.fsrsData.reps;
  fsrsCard.lapses = card.fsrsData.lapses;
  fsrsCard.state = card.fsrsData.state;
  fsrsCard.last_review = card.fsrsData.last_review;

  const reviewResult = fsrs.repeat(fsrsCard, new Date())[rating as Grade];
  
  return {
    ...card,
    fsrsData: {
      due: reviewResult.card.due,
      stability: reviewResult.card.stability,
      difficulty: reviewResult.card.difficulty,
      elapsed_days: reviewResult.card.elapsed_days,
      scheduled_days: reviewResult.card.scheduled_days,
      reps: reviewResult.card.reps,
      lapses: reviewResult.card.lapses,
      state: reviewResult.card.state,
      last_review: reviewResult.card.last_review,
    },
  };
}

export function getCardsForStudy(cards: Card[]): Card[] {
  const now = new Date();
  return cards.filter(card => card.fsrsData.due <= now);
}

export function getCardStats(cards: Card[]) {
  const stats = {
    total: cards.length,
    new: 0,
    learning: 0,
    review: 0,
  };

  cards.forEach(card => {
    switch (card.fsrsData.state) {
      case State.New:
        stats.new++;
        break;
      case State.Learning:
      case State.Relearning:
        stats.learning++;
        break;
      case State.Review:
        stats.review++;
        break;
    }
  });

  return stats;
}