-- Create webhook trigger for feedback email notifications
-- This sends a webhook to the Edge Function when new feedback is inserted
--
-- NOTE: This requires setting up the webhook in Supabase Dashboard:
-- 1. Go to Database → Webhooks
-- 2. Create new webhook:
--    - Name: feedback-notification
--    - Table: feedback
--    - Events: INSERT
--    - URL: https://<project-ref>.supabase.co/functions/v1/send-feedback-notification
--    - HTTP Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--
-- Alternative: Use pg_net extension for direct HTTP calls from PostgreSQL

-- Enable pg_net extension if available (for direct webhook calls)
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to call Edge Function via pg_net (alternative to Dashboard webhook)
-- Uncomment this if you prefer database-level webhook triggers:
/*
CREATE OR REPLACE FUNCTION notify_feedback_webhook()
RETURNS TRIGGER AS $$
DECLARE
    edge_function_url TEXT;
    service_role_key TEXT;
BEGIN
    -- Get the Edge Function URL from app settings
    edge_function_url := current_setting('app.edge_function_url', true);
    service_role_key := current_setting('app.service_role_key', true);

    IF edge_function_url IS NOT NULL AND service_role_key IS NOT NULL THEN
        PERFORM net.http_post(
            url := edge_function_url || '/send-feedback-notification',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || service_role_key,
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
                'type', 'INSERT',
                'table', 'feedback',
                'record', row_to_json(NEW),
                'old_record', NULL
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_feedback_webhook
    AFTER INSERT ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION notify_feedback_webhook();
*/

COMMENT ON TABLE feedback IS 'User feedback with email notification webhook support. See Database → Webhooks in Supabase Dashboard for configuration.';
