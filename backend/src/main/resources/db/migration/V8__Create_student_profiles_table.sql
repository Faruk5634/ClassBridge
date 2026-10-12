CREATE TABLE student_profiles (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL,
    classroom_id BIGINT NOT NULL,
    parent_profile_id BIGINT,
    user_account_id BIGINT,
    school_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_student_profiles_school FOREIGN KEY (school_id) REFERENCES schools (id),
    CONSTRAINT fk_student_profiles_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms (id),
    CONSTRAINT fk_student_profiles_parent_profile FOREIGN KEY (parent_profile_id) REFERENCES parent_profiles (id),
    CONSTRAINT fk_student_profiles_user_account FOREIGN KEY (user_account_id) REFERENCES user_accounts (id),
    CONSTRAINT uq_student_profiles_school_school_number UNIQUE (school_id, school_number),
    CONSTRAINT uq_student_profiles_user_account UNIQUE (user_account_id)
);
