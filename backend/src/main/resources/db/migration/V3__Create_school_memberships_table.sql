CREATE TABLE school_memberships (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL,
    user_account_id BIGINT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_school_memberships_school FOREIGN KEY (school_id) REFERENCES schools (id),
    CONSTRAINT fk_school_memberships_user_account FOREIGN KEY (user_account_id) REFERENCES user_accounts (id)
);
