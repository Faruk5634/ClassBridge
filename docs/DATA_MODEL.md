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
- Passwords are never stored or logged in plain text in the database, project files, or any other persistent storage; only the one-way BCrypt hash is persisted.
- Whenever an authorized administrator creates a login-enabled account, the system generates a cryptographically secure random initial password.
- The generated initial password is returned only once in the successful creation response to the administrator who created the account (the Superadmin for school administrator and vice-administrator accounts; the school administrator or vice-administrator for teacher, parent, and high-school student accounts). It cannot be retrieved after that response is lost; an authorized password-reset flow is required for recovery.
- Users are not forced to change the initial password on first login, and no forced password change flag is stored on the account. An informational reminder to review credentials may be displayed, but it does not block navigation.
- Users may change their password after signing in through an authenticated account flow.
- A single account cannot combine roles. If one person needs both teacher and parent access, they use two separate accounts with separate usernames and credentials.
- Role-specific information belongs in the corresponding profile or relationship records rather than being duplicated in `UserAccount`. Examples include staff member names in `StaffProfile`, a student's school number and class assignment in `StudentProfile`, and parent-to-student links.
- Roles: `SUPERADMIN`, `SCHOOL_ADMIN`, `SCHOOL_VICE_ADMIN`, `TEACHER`, `PARENT`, and `STUDENT`.
- Superadmin accounts are platform-wide.
- A parent account may be linked to children in one or more schools; school access is derived from the linked child rather than assigning the parent to only one school. A parent account may be linked to multiple students, including students from different schools. A student may have at most one linked parent account in the first version.
- Every high-school student receives a student login account (`UserAccount` with `STUDENT` role) upon enrollment. Primary- and middle-school students do not have login accounts or credentials.

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

Represents profile information for parents and guardians.

- Has a one-to-one relationship with `UserAccount` where `role = PARENT`.
- Stores the parent's required `firstName` and `lastName`.
- Shared contact details such as email and phone number remain in `UserAccount`; do not duplicate them in `ParentProfile`.
- A parent account has no direct `SchoolMembership`. All school access is derived exclusively through linked student profiles.
- A parent account may be linked to multiple students across multiple schools. A student may have at most one linked parent account in the first version.
- **Enrollment workflow:** When enrolling a student, school staff first ask whether the parent already has a ClassBridge account.
  - If one exists, school staff link the student profile to that existing parent account using the parent's exact, globally unique username. This allows reusing the same parent account for children attending different schools or school levels.
  - If no account exists, an authorized school administrator or vice-administrator creates the parent `UserAccount` and `ParentProfile` before linking the student.
  - Newly created parent accounts follow the standard initial-password policy: the system generates a cryptographically secure password, stores only the BCrypt hash, and returns the plain-text password once to the creating administrator (never logged or persisted).

### StudentProfile

Represents an enrolled student at a specific school.

- Every enrolled student has a `StudentProfile`, including primary-, middle-, and high-school students.
- A `StudentProfile` is not itself a login account.
- **Data minimization:** Stores only the student's required `firstName`, `lastName`, `schoolNumber`, `school`, current `classroom`, parent association (required for primary/middle school, optional for high school), student login account reference (for high-school students), and active/inactive enrollment status (`active`). Date of birth, home address, and national identity number are not collected in the first version.
- The student's current grade level is derived from the assigned classroom's `gradeLevel`; it is not duplicated in `StudentProfile`.
- `schoolNumber` is modeled as text up to 50 characters to preserve leading zeros, and is unique within a school (enforced by a composite unique constraint on `(school_id, school_number)`).
- Student profiles are retained as inactive/archived records when a student leaves a school. A new school enrollment creates a separate `StudentProfile`. Only the current classroom assignment is stored on an active profile; class membership history, academic-year tracking, and automatic promotion/transfer processing remain out of scope for the first version. Archived school enrollment profiles are explicitly retained rather than being out of scope.
- **Enrollment rules:**
  - School administrators and vice-administrators enroll students only for their own school, deriving the school from the administrator's membership. The assigned classroom must belong to that school and have a grade level valid for the school's level.
  - For primary- and middle-school students: student login accounts are prohibited; linking a valid, active parent account with an existing `ParentProfile` is required.
  - For high-school students: a student login account (`UserAccount` with `STUDENT` role) is created with a globally unique username and a one-time generated initial password under the standard credential policy; linking an existing parent account is optional.
  - The student profile and (for high-school students) student login account are created atomically in a single transaction.
- **Student login and parent association rules:**
  - **Primary- and middle-school students:** Primary- and middle-school `StudentProfile` records have no linked student `UserAccount` and no login credentials. Their parent association is required.
  - **High-school students:** Every high-school `StudentProfile` has exactly one linked `UserAccount` with the `STUDENT` role, created upon enrollment. The school creates the username and the system generates an initial password under the existing one-time credential policy. Linking a parent account to a high-school student's profile is optional and configured only upon parent request; the student still uses their own login account.
- **Leaving or changing schools:**
  - Student profiles are retained as inactive/archived records when a student leaves a school rather than being permanently deleted.
  - If an archived high-school profile has a linked student login account, that `UserAccount` is deactivated (`isActive = false`) so it can no longer authenticate.
  - If the student enrolls at a different school or school level, a new, separate `StudentProfile` is created for that school and linked to the existing parent account when applicable. The previous school's profile remains archived.
  - Academic-year tracking, automatic promotion/transfer processing, and class membership history remain out of scope.

### Classroom

Represents a class within one school.

- Belongs to one school.
- Has a grade level and a section name (for example, 9/A).
- The combination of school, grade level, and section name is unique.
- Academic-year tracking is not part of the first version.
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
School 1 ─── * StudentProfile
Classroom 1 ─── * StudentProfile
High-school StudentProfile 1 ─── 1 Student UserAccount (STUDENT role)
Primary- / Middle-school StudentProfile (no student UserAccount)
StudentProfile * ─── 0..1 ParentProfile 1 ─── 1 UserAccount (PARENT role)
UserAccount (Teachers) * ─── * Classroom (through TeachingAssignment)
Classroom * ─── 1 HomeroomTeacher (UserAccount with TEACHER role)
Announcement * ─── * Classroom
DirectMessage * ─── 1 Sender UserAccount
DirectMessage * ─── 1 Recipient UserAccount
DirectMessage 0..1 ─── 1 StudentProfile (parent message context)
```

Relationship rules for student profiles:
- Every high-school `StudentProfile` has exactly one linked `UserAccount` with the `STUDENT` role.
- Primary- and middle-school `StudentProfile` records have no linked student `UserAccount`.
- Parent association is required for primary- and middle-school `StudentProfile` records and optional for high-school `StudentProfile` records (at most one linked parent account per student in the first version).

## 3. Rules the data model must support

1. Every school-owned record can be traced to a school, directly or through a required parent entity.
2. School users can only access records belonging to their own school.
3. A parent can access only the student profiles explicitly linked to that parent account (at most one parent account per student in the first version; parent association is required for primary/middle school and optional for high school).
4. A parent can switch between linked children while retaining the parent's own account and profile.
5. Every high-school `StudentProfile` has exactly one linked `UserAccount` with the `STUDENT` role; primary- and middle-school `StudentProfile` records have no linked student `UserAccount`.
6. A teacher's announcement targets must be limited to classes assigned to that teacher.
7. Direct-message sender/recipient rules must be validated on the server for every request.
8. A parent's message must preserve the parent as sender and record the selected child context.
9. Announcement read receipts are absent; direct messages support read/unread state.

## 4. Open modeling decisions

- The precise parent notification flow.

## 5. School level, grade, and uniqueness constraints

- `School` has one `education_level`: `PRIMARY`, `MIDDLE`, or `HIGH_SCHOOL`.
- `Classroom.grade_level` is an integer from 1 to 12 and must fall within the school's level: 1–4 for primary, 5–8 for middle, and 9–12 for high school.
- A classroom has a grade level and a section name, and the combination of school, grade level, and section name is unique, enforced by a composite unique constraint on `(school_id, grade_level, section_name)`. Academic-year tracking is not part of the first version.
- Every high-school `StudentProfile` has exactly one linked `UserAccount` with the `STUDENT` role. Primary- and middle-school `StudentProfile` records have no linked student `UserAccount`.
- Parent linking is required for primary- and middle-school students; for high-school students, parent linking is optional and configured only upon parent request.
- `StudentProfile.school_number` is unique within a school, enforced by a composite unique constraint on `(school_id, school_number)`.
- `StudentProfile` adheres to data minimization: it does not store date of birth, home address, or national identity number; grade level is derived from the assigned classroom.
- Student profiles are retained as inactive/archived records when a student leaves a school, and any linked high-school student `UserAccount` is deactivated. A new school enrollment creates a separate `StudentProfile` under that school.
- Academic-year tracking, automatic promotion/transfer processing, and class membership history remain out of scope for the first version; student profiles store only their current class assignment.
- `UserAccount.username` is globally unique across the platform.
- A parent account is not assigned to a single school; access to each school is derived from linked student profiles.

**Confirmed decision:** Each `School` record represents exactly one school level. If a broader institution operates multiple levels, each level is represented as a separate school record (for example, Aktürk Primary School and Aktürk Middle School).

## 6. School identity and location

- Each `School` has a unique system-generated internal identifier.
- School names are not globally unique and must not have a unique constraint.
- Store province/city and district for school identification; address details may also be stored.
- School selection interfaces display the school name and location together. The internal ID remains the stable identifier used by the API and database.
- A user-managed school code is outside the first-version scope.
