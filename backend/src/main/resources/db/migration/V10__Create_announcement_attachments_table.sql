CREATE TABLE announcement_attachments (
    id BIGSERIAL PRIMARY KEY,
    announcement_id BIGINT NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    display_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_announcement_attachments_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (id) ON DELETE CASCADE,
    CONSTRAINT uq_announcement_attachments_storage_key UNIQUE (storage_key)
);

CREATE INDEX idx_announcement_attachments_announcement ON announcement_attachments (announcement_id);
