-- Create feedback table for user feedback submissions
-- This table stores user feedback and triggers email notifications

CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('bug', 'feature', 'general')),
    message TEXT NOT NULL,
    email VARCHAR(255),
    page_url TEXT,
    user_agent TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for filtering by status and type
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert feedback (no auth required for submissions)
CREATE POLICY "Anyone can submit feedback"
    ON feedback
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy: Only authenticated users can read feedback (for admin dashboard)
CREATE POLICY "Authenticated users can read feedback"
    ON feedback
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Only authenticated users can update feedback status
CREATE POLICY "Authenticated users can update feedback"
    ON feedback
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_feedback_updated_at
    BEFORE UPDATE ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

-- Grant necessary permissions
GRANT INSERT ON feedback TO anon;
GRANT ALL ON feedback TO authenticated;

COMMENT ON TABLE feedback IS 'User feedback submissions with email notification support';
COMMENT ON COLUMN feedback.type IS 'Type of feedback: bug, feature, or general';
COMMENT ON COLUMN feedback.status IS 'Processing status: new, read, resolved, or archived';
