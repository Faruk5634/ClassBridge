CREATE TABLE staff_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_account_id BIGINT NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_staff_profiles_user_account FOREIGN KEY (user_account_id) REFERENCES user_accounts (id)
);
