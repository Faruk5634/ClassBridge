# EduConnect — Initial Data Model

**Document status:** Draft for review (v0.1)  
**Document language:** English

This document translates the agreed project scope into an initial domain model. It describes concepts and relationships, not final database column definitions.

## 1. Core entities

### School

Represents one school using EduConnect.

- A school owns its school administrators, teachers, classes, and students.
- A school has one or more administrator accounts, each assigned to that school.
- School-owned data must always be isolated from other schools.

### UserAccount

Represents login credentials and shared identity information.

- Contains a unique username, securely stored password, role, contact details, and account status.
- Roles: `SUPERADMIN`, `SCHOOL_ADMIN`, `SCHOOL_VICE_ADMIN`, `TEACHER`, `PARENT`, and `STUDENT`.
- Superadmin accounts are platform-wide and are not assigned to a school.
- School administrator, vice-administrator, and teacher accounts belong to one school.
- A parent account may be linked to children in one or more schools; school access is derived from the linked child rather than assigning the parent to only one school.
- A student login account is optional and is created only for high-school students in the first version.

### TeacherProfile

Contains teacher-specific information and references one `UserAccount` with the `TEACHER` role.

### ParentProfile

Contains parent-specific information and references one `UserAccount` with the `PARENT` role.

### StudentProfile

Represents a student at a school.

- Belongs to one school and one current class at a time in the initial model.
- Only the current class assignment is stored; class membership history is out of scope for the first version.
- Is linked to exactly one parent account for access in the first version.
- May reference one student `UserAccount` for high-school login; younger students have no login account.
- Stores the student's grade and school identifier as needed by the school.

### Classroom

Represents a class within one school.

- Belongs to one school.
- Has one designated homeroom/advisory teacher.
- Contains multiple students.
- Can have multiple subject-teacher assignments.

### TeachingAssignment

Associates a teacher with a class they teach.

- A teacher can have assignments to multiple classes.
- A class can have multiple teachers.
- The homeroom/advisory teacher relationship is separate from subject teaching assignments.
- A homeroom teacher may also have a teaching assignment for the same class.

### Announcement

Represents a school announcement authored by a teacher or an authorized school administrator.

- Belongs to one school and has one author.
- Targets one or more classrooms.
- May have zero or more file attachments.
- Does not track whether recipients have read it in the first version.

### DirectMessage

Represents one private message from one user to one user.

- Stores sender, recipient, subject, body, sent time, and read/unread status.
- Is associated with a school context for school-level communication and tenant validation.
- For a message sent by a parent, optionally references the selected child that provides the school and student context.
- A parent message remains authored by the parent account; it is never sent as the student's account.
- Superadmin-to-school-administrator messages retain the relevant school context for system support communication.

## 2. Relationship overview

```text
School 1 ─── * SchoolAdminAccount
School 1 ─── * TeacherProfile ─── 1 UserAccount
School 1 ─── * Classroom
School 1 ─── * StudentProfile ─── 1 ParentProfile ─── 1 UserAccount
StudentProfile 0..1 ─── 1 Student UserAccount (high-school login only)
Classroom 1 ─── * StudentProfile
TeacherProfile * ─── * Classroom (through TeachingAssignment)
Classroom * ─── 1 HomeroomTeacher (TeacherProfile)
Announcement * ─── * Classroom
DirectMessage * ─── 1 Sender UserAccount
DirectMessage * ─── 1 Recipient UserAccount
DirectMessage 0..1 ─── 1 StudentProfile (parent message context)
```

## 3. Rules the data model must support

1. Every school-owned record can be traced to a school, directly or through a required parent entity.
2. School users can only access records belonging to their own school.
3. A parent can access only the student profiles explicitly linked to that parent account.
4. A parent can switch between linked children while retaining the parent's own account and profile.
5. A student account is allowed only for high-school students in the first version.
6. A teacher's announcement targets must be limited to classes assigned to that teacher.
7. Direct-message sender/recipient rules must be validated on the server for every request.
8. A parent's message must preserve the parent as sender and record the selected child context.
9. Announcement read receipts are absent; direct messages support read/unread state.

## 4. Open modeling decisions

- The precise parent notification or first-login credential setup flow.
- Whether teacher, student, and parent profile details should be kept in role-specific tables or consolidated into a shared profile structure. The domain relationships above remain the same either way.

## 5. School level, grade, and uniqueness constraints

- `School` has one `education_level`: `PRIMARY`, `MIDDLE`, or `HIGH_SCHOOL`.
- `Classroom.grade_level` is an integer from 1 to 12 and must fall within the school's level: 1–4 for primary, 5–8 for middle, and 9–12 for high school.
- A student account is permitted only for students in a high-school class. Parent access remains available for students at all levels.
- `StudentProfile.school_number` is unique within a school, enforced by a composite unique constraint on `(school_id, school_number)`.
- `UserAccount.username` is globally unique across the platform.
- A parent account is not assigned to a single school; access to each school is derived from the linked student profile.
- Student profiles store only their current class assignment in the first version; class membership history is not stored.

**Initial assumption:** Each `School` record represents one school level. If one institution must manage primary, middle, and high-school classes under one school record, this should be revisited before finalizing the schema.
