ALTER TABLE announcements
    DROP CONSTRAINT chk_announcements_type;

ALTER TABLE announcements
    ADD CONSTRAINT chk_announcements_type
        CHECK (announcement_type IN ('GENERAL', 'HOMEWORK', 'EXAM', 'EVENT', 'EXAM_RESULTS'));
