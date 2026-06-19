-- Messaging indexes for direct conversation lookups and inbox sorting.

CREATE INDEX idx_conversation_participant_a_last_message
ON Conversation(participant_a_user_id, last_message_at DESC);

CREATE INDEX idx_conversation_participant_b_last_message
ON Conversation(participant_b_user_id, last_message_at DESC);

CREATE INDEX idx_conversation_last_message_at
ON Conversation(last_message_at DESC);

CREATE INDEX idx_message_conversation_created
ON Message(conversation_id, created_at DESC);

CREATE INDEX idx_message_sender_created
ON Message(sender_user_id, created_at DESC);
