-- Add group access fields to decks table
ALTER TABLE decks ADD COLUMN IF NOT EXISTS group_access_enabled BOOLEAN DEFAULT false;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Create deck_user_access table for many-to-many relationship
CREATE TABLE IF NOT EXISTS deck_user_access (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one access record per user per deck
    UNIQUE(deck_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_deck_user_access_deck_id ON deck_user_access(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_user_access_user_id ON deck_user_access(user_id);
CREATE INDEX IF NOT EXISTS idx_deck_user_access_granted_by ON deck_user_access(granted_by);
CREATE INDEX IF NOT EXISTS idx_decks_group_access ON decks(group_access_enabled);
CREATE INDEX IF NOT EXISTS idx_decks_is_public ON decks(is_public);

-- Enable Row Level Security
ALTER TABLE deck_user_access ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for deck_user_access
-- Users can see their own access grants
CREATE POLICY "Users can see their own deck access" ON deck_user_access
    FOR SELECT USING (auth.uid() = user_id);

-- Admins and superusers can see all access grants
CREATE POLICY "Admins can see all deck access" ON deck_user_access
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'superuser')
        )
    );

-- Only admins and superusers can manage deck access
CREATE POLICY "Admins can manage deck access" ON deck_user_access
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'superuser')
        )
    );

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_deck_user_access_updated_at 
    BEFORE UPDATE ON deck_user_access 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to check if user has access to a deck
CREATE OR REPLACE FUNCTION user_has_deck_access(user_uuid UUID, deck_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if deck exists
    IF NOT EXISTS (SELECT 1 FROM decks WHERE id = deck_uuid) THEN
        RETURN FALSE;
    END IF;
    
    -- Check if deck is public or group access is disabled
    IF EXISTS (
        SELECT 1 FROM decks 
        WHERE id = deck_uuid 
        AND (is_public = true OR group_access_enabled = false)
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has explicit access
    IF EXISTS (
        SELECT 1 FROM deck_user_access 
        WHERE deck_id = deck_uuid AND user_id = user_uuid
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is admin/superuser (they have access to all decks)
    IF EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_id = user_uuid 
        AND role IN ('admin', 'superuser')
    ) THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION user_has_deck_access(UUID, UUID) TO authenticated;