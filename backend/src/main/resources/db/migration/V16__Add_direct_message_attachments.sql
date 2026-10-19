CREATE TABLE direct_message_attachments (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    display_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_direct_message_attachments_message FOREIGN KEY (message_id) REFERENCES direct_messages (id) ON DELETE CASCADE,
    CONSTRAINT uq_direct_message_attachments_storage_key UNIQUE (storage_key)
);

CREATE INDEX idx_direct_message_attachments_message ON direct_message_attachments (message_id);
