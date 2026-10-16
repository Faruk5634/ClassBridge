ALTER TABLE account_recovery_tokens
    ALTER COLUMN token_hash TYPE VARCHAR(64)
    USING RTRIM(token_hash)::VARCHAR(64);
