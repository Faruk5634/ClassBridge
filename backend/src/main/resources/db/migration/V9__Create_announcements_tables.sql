CREATE TABLE announcements (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL,
    author_account_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_announcements_school FOREIGN KEY (school_id) REFERENCES schools (id),
    CONSTRAINT fk_announcements_author_account FOREIGN KEY (author_account_id) REFERENCES user_accounts (id)
);

CREATE TABLE announcement_classrooms (
    id BIGSERIAL PRIMARY KEY,
    announcement_id BIGINT NOT NULL,
    classroom_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_announcement_classrooms_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (id) ON DELETE CASCADE,
    CONSTRAINT fk_announcement_classrooms_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms (id),
    CONSTRAINT uq_announcement_classrooms_announcement_classroom UNIQUE (announcement_id, classroom_id)
);

CREATE INDEX idx_announcements_school ON announcements (school_id);
CREATE INDEX idx_announcements_author ON announcements (author_account_id);
CREATE INDEX idx_announcement_classrooms_announcement ON announcement_classrooms (announcement_id);
CREATE INDEX idx_announcement_classrooms_classroom ON announcement_classrooms (classroom_id);
