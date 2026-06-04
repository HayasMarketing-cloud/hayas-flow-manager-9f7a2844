
-- Enable RLS on realtime.messages and restrict private channel subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notification channel" ON realtime.messages;
CREATE POLICY "Users can read own notification channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = ('notifications:user:' || auth.uid()::text))
);
