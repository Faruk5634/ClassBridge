CREATE TABLE classrooms (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL,
    grade_level INT NOT NULL CHECK (grade_level >= 1 AND grade_level <= 12),
    section_name VARCHAR(20) NOT NULL,
    homeroom_teacher_account_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_classrooms_school FOREIGN KEY (school_id) REFERENCES schools (id),
    CONSTRAINT fk_classrooms_homeroom_teacher FOREIGN KEY (homeroom_teacher_account_id) REFERENCES user_accounts (id),
    CONSTRAINT uq_classrooms_school_grade_section UNIQUE (school_id, grade_level, section_name)
);
