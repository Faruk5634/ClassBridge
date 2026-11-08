ALTER TABLE user_accounts
    ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE parent_school_registrations (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL,
    parent_profile_id BIGINT NOT NULL,
    registered_by_user_account_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_parent_school_registrations_school_parent UNIQUE (school_id, parent_profile_id),
    CONSTRAINT fk_parent_school_registrations_school FOREIGN KEY (school_id) REFERENCES schools (id),
    CONSTRAINT fk_parent_school_registrations_parent FOREIGN KEY (parent_profile_id) REFERENCES parent_profiles (id),
    CONSTRAINT fk_parent_school_registrations_registered_by FOREIGN KEY (registered_by_user_account_id) REFERENCES user_accounts (id)
);

CREATE INDEX idx_parent_school_registrations_school ON parent_school_registrations (school_id);
