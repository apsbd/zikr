-- Create decks table
CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  author VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cards table
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back_bangla TEXT NOT NULL,
  back_english TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_decks_created_at ON decks(created_at);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_decks_updated_at 
    BEFORE UPDATE ON decks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at 
    BEFORE UPDATE ON cards 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now - you can restrict later)
CREATE POLICY "Allow all operations on decks" ON decks FOR ALL USING (true);
CREATE POLICY "Allow all operations on cards" ON cards FOR ALL USING (true);

-- Insert sample data (optional)
INSERT INTO decks (id, title, description, author) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Arabic to Bangla - Basic Words', 'Learn 10 basic Arabic words with Bangla translations', 'System')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cards (deck_id, front, back_bangla, back_english) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'كِتَابٌ', 'কিতাব', 'Book'),
('550e8400-e29b-41d4-a716-446655440000', 'قَلَمٌ', 'কলম', 'Pen'),
('550e8400-e29b-41d4-a716-446655440000', 'بَيْتٌ', 'ঘর', 'House'),
('550e8400-e29b-41d4-a716-446655440000', 'مَاءٌ', 'পানি', 'Water'),
('550e8400-e29b-41d4-a716-446655440000', 'طَعَامٌ', 'খাবার', 'Food'),
('550e8400-e29b-41d4-a716-446655440000', 'بَابٌ', 'দরজা', 'Door'),
('550e8400-e29b-41d4-a716-446655440000', 'شَمْسٌ', 'সূর্য', 'Sun'),
('550e8400-e29b-41d4-a716-446655440000', 'قَمَرٌ', 'চাঁদ', 'Moon'),
('550e8400-e29b-41d4-a716-446655440000', 'وَرْدٌ', 'ফুল', 'Rose/Flower'),
('550e8400-e29b-41d4-a716-446655440000', 'طَالِبٌ', 'ছাত্র', 'Student')
ON CONFLICT DO NOTHING;