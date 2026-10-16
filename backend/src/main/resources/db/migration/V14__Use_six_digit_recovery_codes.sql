ALTER TABLE account_recovery_tokens
    DROP CONSTRAINT IF EXISTS account_recovery_tokens_token_hash_key;

ALTER TABLE account_recovery_tokens
    ALTER COLUMN token_hash TYPE VARCHAR(100),
    ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;

UPDATE account_recovery_tokens
SET used_at = CURRENT_TIMESTAMP
WHERE used_at IS NULL;
