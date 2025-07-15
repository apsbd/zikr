export interface Database {
  public: {
    Tables: {
      decks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          author: string;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          author: string;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          author?: string;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      cards: {
        Row: {
          id: string;
          deck_id: string;
          front: string;
          back_bangla: string;
          back_english: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          deck_id: string;
          front: string;
          back_bangla: string;
          back_english: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          deck_id?: string;
          front?: string;
          back_bangla?: string;
          back_english?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_progress: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          state: number;
          difficulty: number;
          stability: number;
          retrievability: number;
          due: string;
          elapsed_days: number;
          scheduled_days: number;
          reps: number;
          lapses: number;
          last_review: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          state: number;
          difficulty: number;
          stability: number;
          retrievability: number;
          due: string;
          elapsed_days: number;
          scheduled_days: number;
          reps: number;
          lapses: number;
          last_review?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          state?: number;
          difficulty?: number;
          stability?: number;
          retrievability?: number;
          due?: string;
          elapsed_days?: number;
          scheduled_days?: number;
          reps?: number;
          lapses?: number;
          last_review?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          role: 'user' | 'admin' | 'superuser';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          role?: 'user' | 'admin' | 'superuser';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          role?: 'user' | 'admin' | 'superuser';
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}