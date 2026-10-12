CREATE TABLE teaching_assignments (
    id BIGSERIAL PRIMARY KEY,
    classroom_id BIGINT NOT NULL,
    teacher_account_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_teaching_assignments_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms (id),
    CONSTRAINT fk_teaching_assignments_teacher_account FOREIGN KEY (teacher_account_id) REFERENCES user_accounts (id),
    CONSTRAINT uq_teaching_assignments_classroom_teacher UNIQUE (classroom_id, teacher_account_id)
);
