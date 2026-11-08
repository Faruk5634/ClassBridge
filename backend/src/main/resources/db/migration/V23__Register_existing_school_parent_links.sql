WITH school_administrators AS (
    SELECT sm.school_id, MIN(sm.user_account_id) AS registered_by_user_account_id
    FROM school_memberships sm
    JOIN user_accounts ua ON ua.id = sm.user_account_id
    WHERE ua.role IN ('SCHOOL_ADMIN', 'SCHOOL_VICE_ADMIN')
    GROUP BY sm.school_id
)
INSERT INTO parent_school_registrations (school_id, parent_profile_id, registered_by_user_account_id)
SELECT DISTINCT student.school_id,
                student.parent_profile_id,
                school_administrators.registered_by_user_account_id
FROM student_profiles student
JOIN school_administrators ON school_administrators.school_id = student.school_id
WHERE student.parent_profile_id IS NOT NULL
ON CONFLICT (school_id, parent_profile_id) DO NOTHING;
