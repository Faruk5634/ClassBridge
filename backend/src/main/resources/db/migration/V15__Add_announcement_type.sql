ALTER TABLE announcements
    ADD COLUMN announcement_type VARCHAR(32) NOT NULL DEFAULT 'GENERAL';

ALTER TABLE announcements
    ADD CONSTRAINT chk_announcements_type
        CHECK (announcement_type IN ('GENERAL', 'EXAM', 'EVENT', 'EXAM_RESULTS'));
