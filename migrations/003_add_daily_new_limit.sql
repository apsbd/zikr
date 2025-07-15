-- Add daily_new_limit column to decks table
ALTER TABLE decks ADD COLUMN IF NOT EXISTS daily_new_limit INTEGER DEFAULT 20;

-- Update existing decks to have a default value
UPDATE decks SET daily_new_limit = 20 WHERE daily_new_limit IS NULL;