# ClassBridge — Project Scope

**Document status:** Active
**Document language:** English  
**Product type:** Multi-tenant school communication and announcement platform

## 1. Project purpose

ClassBridge helps schools communicate announcements to the right students and families in one place. It reduces the chance that parents miss important school information because it is spread across multiple messaging groups. The platform supports multiple schools, with each school managing its own users, classes, and communication.

## 2. Product boundaries

The platform focuses on school administration, class-based announcements, and direct communication between permitted users. It is not intended to be a full school information system. Grading, attendance tracking, exams, and timetables are outside the initial scope.

The platform carries forward the existing project's main capabilities: school and account administration, class management, role-specific dashboards, announcements, announcement attachments, direct messages, and profile updates. A classroom has a grade level and a section name (for example, 9/A); the combination of school, grade level, and section name is unique. Academic-year tracking is not part of the first version. System audit logs are deferred.

## 3. Roles and responsibilities

### 3.1 Superadmin

- Manages schools across the platform.
- Creates school administrator and vice-administrator accounts and assigns them to a school.
- Communicates with school administrators about platform or system issues.

### 3.2 School administrator and vice-administrator

- Manages users, classes, and announcements for their own school.
- Creates teacher, student, and parent accounts for their school.
- Communicates with the Superadmin about platform or system issues.
- Can communicate with teachers and vice-administrators in the same school.

### 3.3 Teacher

- Can be assigned to teach multiple classes.
- Can be designated as the homeroom/advisory teacher of a class. Each class has one homeroom/advisory teacher.
- Creates announcements for one or more classes they teach.
- Can search for and message any active student in their own school by student name or school number, regardless of classroom teaching assignments.
- Can communicate with school administrators and vice-administrators in the same school.
- Cannot search for or start a direct conversation with a parent account. For primary- and middle-school students, messages are delivered in the linked parent's account within the selected child's message area.

### 3.4 Student

- Every high-school student receives a student login account upon enrollment.
- Primary- and middle-school students do not sign in; their parent accesses the student's information through the parent's account.
- Can view announcements and start or reply to conversations with teachers, school administrators, and vice-administrators in their own school.
- Cannot message other students or parents.
- When a high-school student leaves a school, their student login account is deactivated.

### 3.5 Parent

- Signs in with a parent account and can access one or more linked children across one or multiple schools.
- Parent accounts have no direct school membership; access to a school is derived exclusively through linked student profiles.
- When enrolling a student, school staff first ask whether the parent already has a ClassBridge account:
  - If an account exists, staff link the student profile to the existing parent account using the parent's exact username (reusing one parent account across different schools and school levels).
  - If no account exists, an authorized school administrator or vice-administrator creates the parent account and profile before linking the student.
- Newly created parent accounts receive a securely generated initial password under the one-time credential policy.
- A student may be linked to at most one parent account in the first version. Parent linking is required for primary- and middle-school students, and optional for high-school students (configured only upon parent request).
- Can select a child to enter that child's view, return to the parent's own profile, or switch to another linked child without signing out.
- Can update the parent's own profile independently of the selected child's view.
- Can access a high-school student's information (if linked) as well as younger students' information.
- Selects a child before opening that child's message area. The parent can start or reply to conversations with teachers, school administrators, and vice-administrators at that child's school.
- Parent messages are sent by the parent's account and clearly identify that the sender is a parent. The selected child is recorded as the context; the parent never impersonates the student.
- For primary- and middle-school students, the parent can read and reply to staff-started conversations in the child's message area.
- For high-school students, the parent can read the student's and staff's existing conversations but cannot reply to or otherwise participate in them. The parent's read-only view does not clear the student's unread status. The parent may start a separate conversation from the child's view; it is labeled as parent-authored and is not visible to or actionable by the student.
- Cannot message other parents or students.

## 4. Direct-message permissions

| Sender | Permitted recipients |
|---|---|
| Teacher | Any active student, and school administrators or vice-administrators, in the teacher's school |
| High-school student | Teachers and school administrators or vice-administrators in the student's school |
| Parent | Teachers and school administrators or vice-administrators at the selected child's school |
| School administrator or vice-administrator | Superadmin for platform/system support; teachers and active students in the same school |
| Superadmin | School administrators and vice-administrators, for platform or system issues |

Messaging is an asynchronous, in-app, text-only conversation system, not real email or live chat. A conversation has no subject; replies remain in that conversation, and the same participants may start another separate conversation. Messages are loaded when the user opens or refreshes the inbox. The first version has in-app read/unread status only, with no email or push notifications.

Recipient search and message submission must both enforce these rules. Staff search only active students in their own school by name or school number and do not directly search for parent accounts. For primary/middle-school students, the linked parent is the account recipient and the student profile provides context. For high-school students, the student is the account recipient. A linked parent may read high-school student/staff conversations without participating or clearing the student's unread status; parent-authored conversations are separate and hidden from the student. Messages between teachers, between students, between parents, and between students and parents are not permitted. School administrators and vice-administrators have equal messaging permissions in the first version. Cross-school messaging is never allowed except Superadmin support conversations with the relevant school administrators.

## 5. Announcements

- School administrators and vice-administrators can create announcements targeting classrooms in their own school.
- Teachers can target one or multiple classrooms within their own school. Individual teaching assignments or homeroom responsibility are not required. The backend must reject classrooms belonging to another school.
- Announcements are visible to school staff in the author's school, and to students and parents associated with the targeted active class or classes.
- Archived student profiles do not grant access to announcements.
- Announcement read receipts, drafts, and scheduling are not included.
- File attachments are supported for existing announcements:
  - Supported file types are limited to PDF, JPEG, and PNG.
  - File size is limited to at most 10 MB per file.
  - Validation requires matching file content signatures (magic bytes) as well as filenames and MIME content types.
  - Original filenames are sanitized for display, and unique server-generated UUID storage keys are used for disk storage.
  - File bytes are stored on the local filesystem outside the repository in a configurable directory (`${user.home}/.classbridge/attachments` by default, overridable with `CLASSBRIDGE_ATTACHMENT_STORAGE_DIR`); PostgreSQL stores only attachment metadata. Physical storage paths and storage keys are never exposed in API responses or static URLs.
  - School administrators and vice-administrators can attach files to any announcement in their school; teachers can attach files only to their own announcements.
  - Authorized downloads are available to school staff in the announcement's school, students in targeted active classrooms, and parents of active linked children in targeted classrooms. Archived profiles do not grant access.

## 6. Accounts and profiles

- There is no public self-registration in the normal user flow.
- The Superadmin creates school administrator and vice-administrator accounts; school administrators and vice-administrators create teacher, parent (when enrolling a student if not already registered), and high-school student accounts for their school. Primary- and middle-school students do not have login accounts.
- When enrolling a student, school staff check if the parent already has an account by globally unique username and link the student profile to that account, or provision a new parent account if none exists.
- Every high-school student receives a `UserAccount` with the `STUDENT` role upon enrollment. Primary- and middle-school students have no login credentials; their parent link is required. Linking a parent account to a high-school student's profile is optional and configured only upon parent request.
- Whenever an authorized administrator creates a login-enabled account, the system generates a cryptographically secure random initial password.
- That initial password is returned exactly once in the successful account-creation response to the administrator who created the account (the Superadmin for school administrator and vice-administrator accounts; the school administrator or vice-administrator for teacher, parent, and high-school student accounts).
- The plain-text password is never logged or stored in the database, project files, or any other persistent storage; only the BCrypt hash is stored.
- A generated initial password cannot be retrieved after the creation response is lost; an authorized password-reset flow will be needed for recovery.
- Users are not forced to change the initial password on first login. The interface may show an informational reminder about reviewing account credentials, but it must not block the user from continuing.
- Users may change their password after signing in through an authenticated account flow.
- Authenticated password changes require the current password; the new password must contain 8–20 characters and fit BCrypt's 72-byte UTF-8 limit. Already-issued JWTs remain valid only until their normal expiration.
- Email and phone number remain optional. The first self-service recovery channel is a verified email address; SMS may be added later. Users without a verified email use an authorized administrator-assisted reset.
- Signed-in users can add or change their email address; a changed address must be verified again before it can be used for recovery.
- Email verification and password recovery use generic responses where account existence must remain private, single-use six-digit codes that expire after 30 minutes, and rate limits. Codes are stored as BCrypt hashes and each code allows at most five confirmation attempts. A successful reset invalidates previously issued access tokens.
- Authorized fallback: `SUPERADMIN` can reset active `SCHOOL_ADMIN` and `SCHOOL_VICE_ADMIN` accounts; a school administrator or vice-administrator can reset eligible active teacher, student, or parent accounts associated with their own school. The API returns a cryptographically generated temporary password once to the authorized administrator. Resetting a shared parent account changes that parent's credentials across all linked schools.
- Signed-in users can view their own profile through `GET /api/auth/me` and update their own nonblank phone number through `PUT /api/auth/phone`. Email is changed only through `PUT /api/auth/email` and must be verified again before recovery can use it.
- Users cannot change their own first name, last name, username, role, or school association. Names are set during account/profile creation. School administrators and vice-administrators may correct active student profile details within their school through the existing student-management flow; archived student profiles remain read-only.
- The self-profile response contains only the authenticated account's own identity and contact fields; it never exposes password hashes, recovery codes, or credential-version data.
- School staff members (school administrators, vice-administrators, and teachers) have a staff profile storing their required first name and last name, while their school linkage is handled via school membership. Superadmin, parent, and student accounts do not use a staff profile.
- Parent profiles store the parent's first and last name, referencing a `UserAccount` with the `PARENT` role. Shared contact details remain in `UserAccount`.
- Student profiles store minimal student data: first name, last name, school number (modeled as text up to 50 characters preserving leading zeros, unique within the school), school, classroom, active/inactive enrollment status, parent association, and student login account reference (for high-school students). Date of birth, home address, and national identity numbers are not collected. Grade level is derived from the assigned classroom.
- School administrators and vice-administrators can update an active student's profile (school number, first name, last name, and classroom) within their school. Editing archived student profiles is prohibited.
- When a student leaves a school, an authorized administrator can soft-archive their student profile (`active = false`). Any linked high-school student login account is deactivated in the same transaction so it can no longer authenticate. The linked parent account remains active. Enrolling at another school creates a new student profile under that school and links the existing parent account when applicable.
- Every user account has exactly one role. A single account cannot combine roles. If one person needs both teacher and parent access, they use two separate accounts with separate usernames and credentials. A student login account cannot also be a parent account.
- A parent account may be linked to multiple students, including students from different schools. A student has at most one linked parent account in the first version.

## 7. Message status

Direct messages support in-app read/unread status. This is separate from announcement read receipts, which are excluded from the first version. The first version does not send email or push notifications and does not provide real-time chat delivery.

## 8. Non-goals

- System audit-log screens and a full audit trail.
- Multiple parent/guardian accounts accessing the same student.
- Student-to-student, parent-to-parent, teacher-to-teacher, or student-to-parent direct messaging.
- Grades, attendance, exams, and timetables.
- Academic-year tracking and multi-year classroom history.
- Automatic student promotion, student school transfer workflows, and academic-year processing.
- Collection of student date of birth, home address, or national identity number.

## 9. Decisions to confirm during detailed design

- No open profile self-service decisions remain for the first version: names and account identifiers are read-only to users; users may update their own phone number and change their email through the verification flow.

## 10. Language

English is the required language for the project documentation and initial application interface because the course is taught in English. Turkish interface support may be added later.

## 11. School levels and student login

The platform treats school level as one of three distinct values. Each school record represents exactly one level. If a broader institution operates multiple levels, each level is represented as a separate school record (for example, Aktürk Primary School and Aktürk Middle School):

- **Primary school:** grades 1–4. Students do not sign in; their parent accesses their view. Parent association is required.
- **Middle school:** grades 5–8. Students do not sign in; their parent accesses their view. Parent association is required.
- **High school:** grades 9–12. Every student receives a student login account upon enrollment. A parent may also be linked to the student profile if requested by the parent.

A student's current grade is derived from their assigned classroom and must be valid for the school's level. A student number is unique within its school, modeled as text up to 50 characters to preserve leading zeros. A username is unique across the whole platform. A parent account may be linked to children at different schools and switches to a child's view after selecting that child.

## 12. School identification

School names are not unique across the platform. Every school has a unique system-generated internal ID. School selection screens should display the school name together with its province/city and district so that similarly named schools can be distinguished. A user-managed school code is not required.
