ALTER TABLE user_accounts
    ADD COLUMN member_identity_id BIGINT;

CREATE TABLE member_identities (
    id BIGSERIAL PRIMARY KEY,
    public_id VARCHAR(12) NOT NULL UNIQUE,
    identity_type VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
DECLARE
    account_row RECORD;
    identity_row_id BIGINT;
    prefix_value VARCHAR(3);
    public_value VARCHAR(12);
BEGIN
    FOR account_row IN SELECT id, role FROM user_accounts ORDER BY id LOOP
        prefix_value := CASE account_row.role
            WHEN 'SUPERADMIN' THEN '100'
            WHEN 'SCHOOL_ADMIN' THEN '200'
            WHEN 'SCHOOL_VICE_ADMIN' THEN '210'
            WHEN 'PARENT' THEN '300'
            WHEN 'STUDENT' THEN '400'
            WHEN 'TEACHER' THEN '500'
            ELSE NULL
        END;
        IF prefix_value IS NULL THEN
            RAISE EXCEPTION 'Cannot generate public ID for unsupported account role %', account_row.role;
        END IF;
        LOOP
            public_value := prefix_value || LPAD(FLOOR(RANDOM() * 1000000000)::BIGINT::TEXT, 9, '0');
            EXIT WHEN NOT EXISTS (SELECT 1 FROM member_identities WHERE public_id = public_value);
        END LOOP;
        INSERT INTO member_identities (public_id, identity_type)
        VALUES (public_value, account_row.role)
        RETURNING id INTO identity_row_id;
        UPDATE user_accounts SET member_identity_id = identity_row_id WHERE id = account_row.id;
    END LOOP;
END $$;

ALTER TABLE user_accounts
    ALTER COLUMN member_identity_id SET NOT NULL,
    ADD CONSTRAINT uq_user_accounts_member_identity UNIQUE (member_identity_id),
    ADD CONSTRAINT fk_user_accounts_member_identity FOREIGN KEY (member_identity_id) REFERENCES member_identities (id);

CREATE TABLE student_identities (
    id BIGSERIAL PRIMARY KEY,
    member_identity_id BIGINT NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_identities_member_identity FOREIGN KEY (member_identity_id) REFERENCES member_identities (id)
);

ALTER TABLE student_profiles
    ADD COLUMN student_identity_id BIGINT;

DO $$
DECLARE
    student_row RECORD;
    identity_row_id BIGINT;
    member_identity_row_id BIGINT;
    public_value VARCHAR(12);
BEGIN
    FOR student_row IN
        SELECT id, first_name, last_name, user_account_id
        FROM student_profiles
        ORDER BY id
    LOOP
        IF student_row.user_account_id IS NOT NULL THEN
            SELECT member_identity_id INTO member_identity_row_id
            FROM user_accounts WHERE id = student_row.user_account_id;
        ELSE
            LOOP
                public_value := '400' || LPAD(FLOOR(RANDOM() * 1000000000)::BIGINT::TEXT, 9, '0');
                EXIT WHEN NOT EXISTS (SELECT 1 FROM member_identities WHERE public_id = public_value);
            END LOOP;
            INSERT INTO member_identities (public_id, identity_type)
            VALUES (public_value, 'STUDENT')
            RETURNING id INTO member_identity_row_id;
        END IF;
        INSERT INTO student_identities (member_identity_id, first_name, last_name)
        VALUES (member_identity_row_id, student_row.first_name, student_row.last_name)
        RETURNING id INTO identity_row_id;
        UPDATE student_profiles SET student_identity_id = identity_row_id WHERE id = student_row.id;
    END LOOP;
END $$;

ALTER TABLE student_profiles
    ALTER COLUMN student_identity_id SET NOT NULL,
    ADD CONSTRAINT fk_student_profiles_student_identity FOREIGN KEY (student_identity_id) REFERENCES student_identities (id),
    DROP CONSTRAINT fk_student_profiles_user_account,
    DROP CONSTRAINT uq_student_profiles_user_account,
    DROP COLUMN user_account_id;

CREATE UNIQUE INDEX uq_student_profiles_one_active_identity
    ON student_profiles (student_identity_id)
    WHERE is_active = TRUE;

ALTER TABLE school_memberships
    ADD COLUMN branch VARCHAR(100);

UPDATE school_memberships sm
SET branch = sp.branch
FROM staff_profiles sp
WHERE sp.user_account_id = sm.user_account_id;

ALTER TABLE school_memberships
    DROP CONSTRAINT school_memberships_user_account_id_key;

CREATE INDEX idx_school_memberships_account_school ON school_memberships (user_account_id, school_id);
CREATE UNIQUE INDEX uq_school_memberships_one_active_account
    ON school_memberships (user_account_id)
    WHERE is_active = TRUE;
