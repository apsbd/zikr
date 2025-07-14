# Claude Code Prompt: Zikr - Minimal Arabic Learning App

Create a Next.js application called "Zikr" - a clean, minimal Anki-style spaced repetition app for learning Arabic in a closed group setting.

## Core Requirements

### Technology Stack
- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS + shadcn/ui components
- **Algorithm**: Integrate FSRS (Free Spaced Repetition Scheduler) from `https://github.com/open-spaced-repetition/ts-fsrs`
- **State Management**: React Context or Zustand for local state
- **Mobile**: Responsive design optimized for mobile devices
- **Future Backend**: Designed to integrate with Firebase (Authentication & Firestore)

### MVP Features

#### 1. Dashboard View
- Clean, minimal layout showing available decks
- Pre-built "Arabic to Bangla" deck with 10 basic Arabic words
- Card-based deck display with study progress indicators

#### 2. Study Interface
- **Layout**:
  - Back button (top-left corner)
  - Card display (center of screen)
  - Action buttons (bottom)
- **Card Structure**:
  - Front: Arabic word/phrase
  - Back: Bangla translation + English translation
- **Study Flow**:
  - Show front → user thinks → reveal back → rate difficulty
  - FSRS algorithm determines next review time

#### 3. FSRS Integration
- Implement core FSRS scheduling algorithm
- Track card states: New, Learning, Review, Relearning
- Store scheduling data locally (localStorage for MVP)
- Rating system: Again, Hard, Good, Easy

## Technical Specifications

### Project Structure
```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (Dashboard)
│   └── study/[deckId]/page.tsx
├── components/
│   ├── ui/ (shadcn components)
│   ├── Dashboard/
│   ├── StudyCard/
│   └── Navigation/
├── lib/
│   ├── fsrs.ts
│   ├── data.ts (sample deck)
│   └── utils.ts
└── types/
    └── index.ts
```

### Data Models
```typescript
interface Card {
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
    state: CardState;
    last_review?: Date;
  };
}

interface Deck {
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
```

### Sample Data (10 Arabic Words)
Include these basic Arabic words in the default deck:
1. **كِتَابٌ** (Kitābun) - কিতাব (Book)
2. **قَلَمٌ** (Qalamun) - কলম (Pen)
3. **بَيْتٌ** (Baytun) - ঘর (House)
4. **مَاءٌ** (Mā'un) - পানি (Water)
5. **طَعَامٌ** (Ṭa'āmun) - খাবার (Food)
6. **بَابٌ** (Bābun) - দরজা (Door)
7. **شَمْسٌ** (Shamsun) - সূর্য (Sun)
8. **قَمَرٌ** (Qamarun) - চাঁদ (Moon)
9. **وَرْدٌ** (Wardun) - ফুল (Rose/Flower)
10. **طَالِبٌ** (Ṭālibun) - ছাত্র (Student)


## UI/UX Requirements

### Design Principles
- **Minimal**: Clean, distraction-free interface
- **Mobile-first**: Touch-friendly buttons, readable fonts
- **Accessibility**: High contrast, proper focus states
- **Performance**: Smooth animations, fast transitions

### Color Scheme
- Primary: Clean blues/greens for Islamic aesthetic
- Background: White/light gray
- Text: Dark gray for readability
- Accent: Subtle colors for buttons and progress

### Components Needed
- `DeckCard`: Display deck info on dashboard
- `StudyCard`: Main card component with flip animation
- `RatingButtons`: FSRS rating interface (Again, Hard, Good, Easy)
- `ProgressBar`: Show study session progress
- `Navigation`: Back button and menu

## Implementation Steps

1. **Setup Project**
   - Initialize Next.js with TypeScript
   - Install and configure Tailwind CSS + shadcn/ui
   - Install FSRS package: `npm install ts-fsrs`

2. **Core Data Layer**
   - Create type definitions
   - Implement FSRS algorithm wrapper
   - Create sample Arabic deck data
   - Setup localStorage for persistence

3. **Dashboard**
   - Build deck listing page
   - Show study statistics
   - Navigation to study mode

4. **Study Interface**
   - Card display with flip animation
   - FSRS rating system
   - Progress tracking
   - Session completion flow

5. **Mobile Optimization**
   - Touch gestures for card flipping
   - Responsive button sizing
   - Swipe navigation support

## Key Features to Implement

### FSRS Algorithm Integration
- Initialize FSRS scheduler
- Calculate next review dates
- Update card difficulty based on performance
- Handle different card states (New, Learning, Review)

### Study Session Logic
- Queue cards based on FSRS scheduling
- Track session progress
- Save progress after each card
- Handle session interruptions

### Data Persistence
- Use localStorage for MVP
- Design data structure for easy Firebase migration
- Implement data import/export for testing

## Future Considerations
- Authentication system (Firebase Auth)
- Admin panel for deck creation
- User progress analytics
- Offline support with service workers
- Social features (leaderboards, shared decks)

## Success Criteria
✅ Clean, minimal UI that works on mobile
✅ Functional FSRS algorithm with proper scheduling
✅ Smooth study experience with 10 Arabic words
✅ Data persistence between sessions
✅ Ready for Firebase integration
✅ Responsive design for all screen sizes

Build this as a complete, functional MVP that demonstrates the core concept of Zikr while maintaining the clean, minimal aesthetic suitable for focused Arabic learning.
