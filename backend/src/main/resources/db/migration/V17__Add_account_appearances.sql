CREATE TABLE account_appearances (
    user_account_id BIGINT PRIMARY KEY REFERENCES user_accounts(id) ON DELETE CASCADE,
    avatar_type VARCHAR(16) NOT NULL DEFAULT 'INITIALS',
    animal VARCHAR(32),
    image_data_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_account_appearance_avatar_type CHECK (avatar_type IN ('INITIALS', 'ANIMAL', 'PHOTO')),
    CONSTRAINT chk_account_appearance_selection CHECK (
        (avatar_type = 'INITIALS' AND animal IS NULL AND image_data_url IS NULL)
        OR (avatar_type = 'ANIMAL' AND animal IS NOT NULL AND image_data_url IS NULL)
        OR (avatar_type = 'PHOTO' AND animal IS NULL AND image_data_url IS NOT NULL)
    )
);
