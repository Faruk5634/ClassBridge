CREATE TABLE message_conversations (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL,
    participant_one_account_id BIGINT NOT NULL,
    participant_two_account_id BIGINT NOT NULL,
    student_profile_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_message_conversations_school FOREIGN KEY (school_id) REFERENCES schools (id),
    CONSTRAINT fk_message_conversations_participant_one FOREIGN KEY (participant_one_account_id) REFERENCES user_accounts (id),
    CONSTRAINT fk_message_conversations_participant_two FOREIGN KEY (participant_two_account_id) REFERENCES user_accounts (id),
    CONSTRAINT fk_message_conversations_student_profile FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id),
    CONSTRAINT ck_message_conversations_distinct_participants CHECK (participant_one_account_id <> participant_two_account_id)
);

CREATE INDEX idx_message_conversations_participant_one ON message_conversations (participant_one_account_id, last_message_at DESC);
CREATE INDEX idx_message_conversations_participant_two ON message_conversations (participant_two_account_id, last_message_at DESC);
CREATE INDEX idx_message_conversations_student_context ON message_conversations (student_profile_id, last_message_at DESC);

CREATE TABLE direct_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender_account_id BIGINT NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_direct_messages_conversation FOREIGN KEY (conversation_id) REFERENCES message_conversations (id) ON DELETE CASCADE,
    CONSTRAINT fk_direct_messages_sender FOREIGN KEY (sender_account_id) REFERENCES user_accounts (id),
    CONSTRAINT ck_direct_messages_body_not_blank CHECK (length(trim(body)) > 0 AND length(body) <= 5000)
);

CREATE INDEX idx_direct_messages_conversation_created ON direct_messages (conversation_id, created_at, id);
CREATE INDEX idx_direct_messages_unread ON direct_messages (conversation_id, read_at) WHERE read_at IS NULL;
