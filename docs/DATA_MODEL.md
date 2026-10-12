# ClassBridge — Data Model

**Document status:** Active
**Document language:** English

This document translates the agreed project scope into an initial domain model. It describes concepts and relationships, not final database column definitions.

## 1. Core entities

### School

Represents one school using ClassBridge.

- A school owns its school administrators, teachers, classes, and students.
- A school has one or more administrator accounts, each assigned to that school.
- School-owned data must always be isolated from other schools.

### UserAccount

Represents login credentials and shared identity information.

- Stores shared identity and account information, including the globally unique username, securely stored password hash, exactly one role, shared contact details, and account status.
- Passwords are never stored or logged in plain text; only the one-way BCrypt hash is persisted.
- When the Superadmin creates a school administrator or vice-administrator account, the system generates a cryptographically secure random initial password.
- The initial password is returned only once in the successful creation response to the authenticated Superadmin. It cannot be retrieved after that response is lost; an authorized password reset flow is required for recovery.
- Users are not forced to change the initial password on first login, and no forced password change flag is stored on the account. An informational reminder to review credentials may be displayed, but it does not block navigation.
- Users may change their password after signing in through an authenticated account flow.
- A single account cannot combine roles. If one person needs both teacher and parent access, they use two separate accounts with separate usernames and credentials.
- Role-specific information belongs in the corresponding profile or relationship records rather than being duplicated in `UserAccount`. Examples include staff member names in `StaffProfile`, a student's school number and class assignment in `StudentProfile`, and parent-to-student links.
- Roles: `SUPERADMIN`, `SCHOOL_ADMIN`, `SCHOOL_VICE_ADMIN`, `TEACHER`, `PARENT`, and `STUDENT`.
- Superadmin accounts are platform-wide.
- A parent account may be linked to children in one or more schools; school access is derived from the linked child rather than assigning the parent to only one school. A parent account may be linked to multiple students, including students from different schools.
- A student login account is optional and is created only for high-school students in the first version.

### SchoolMembership

Represents the explicit association of a user account with a specific school.

- School administrators, vice-administrators, and teachers each belong to one school through this membership.
- Superadmins do not have a school membership.
- Parents do not have a direct school membership; they access students across multiple schools through parent-to-student links.

### StaffProfile

Represents profile information for school staff members.

- Has a one-to-one relationship with `UserAccount`.
- Stores the staff member's required `firstName` and `lastName`.
- Applies to `SCHOOL_ADMIN`, `SCHOOL_VICE_ADMIN`, and `TEACHER` accounts.
- The existing `SchoolMembership` remains responsible for linking each school staff account to exactly one school; do not duplicate the school relationship in `StaffProfile`.
- Shared contact details such as email and phone number remain in `UserAccount`; do not duplicate them in `StaffProfile`.
- `SUPERADMIN`, `PARENT`, and `STUDENT` accounts do not use `StaffProfile`.
- Preserves the rule that each account has exactly one role.
- School staff accounts—including teachers—use `StaffProfile` for staff identity details; a separate `TeacherProfile` entity is not used.

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
School 1 ─── * SchoolMembership ─── 1 UserAccount (Admins, Teachers)
UserAccount (Admins, Teachers) 1 ─── 1 StaffProfile
School 1 ─── * Classroom
School 1 ─── * StudentProfile ─── 1 ParentProfile ─── 1 UserAccount
StudentProfile 0..1 ─── 1 Student UserAccount (high-school login only)
Classroom 1 ─── * StudentProfile
UserAccount (Teachers) * ─── * Classroom (through TeachingAssignment)
Classroom * ─── 1 HomeroomTeacher (UserAccount with TEACHER role)
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

- The precise parent notification flow.

## 5. School level, grade, and uniqueness constraints

- `School` has one `education_level`: `PRIMARY`, `MIDDLE`, or `HIGH_SCHOOL`.
- `Classroom.grade_level` is an integer from 1 to 12 and must fall within the school's level: 1–4 for primary, 5–8 for middle, and 9–12 for high school.
- A student account is permitted only for students in a high-school class. Parent access remains available for students at all levels.
- `StudentProfile.school_number` is unique within a school, enforced by a composite unique constraint on `(school_id, school_number)`.
- `UserAccount.username` is globally unique across the platform.
- A parent account is not assigned to a single school; access to each school is derived from the linked student profile.
- Student profiles store only their current class assignment in the first version; class membership history is not stored.

**Confirmed decision:** Each `School` record represents exactly one school level. If a broader institution operates multiple levels, each level is represented as a separate school record (for example, Aktürk Primary School and Aktürk Middle School).

## 6. School identity and location

- Each `School` has a unique system-generated internal identifier.
- School names are not globally unique and must not have a unique constraint.
- Store province/city and district for school identification; address details may also be stored.
- School selection interfaces display the school name and location together. The internal ID remains the stable identifier used by the API and database.
- A user-managed school code is outside the first-version scope.
