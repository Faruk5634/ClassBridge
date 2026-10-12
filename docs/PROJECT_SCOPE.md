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

### 3.3 Teacher

- Can be assigned to teach multiple classes.
- Can be designated as the homeroom/advisory teacher of a class. Each class has one homeroom/advisory teacher.
- Creates announcements for one or more classes they teach.
- Sends direct messages to any student, parent, or school administrator in their own school.

### 3.4 Student

- Every high-school student receives a student login account upon enrollment.
- Primary- and middle-school students do not sign in; their parent accesses the student's information through the parent's account.
- Can view announcements and send direct messages to teachers or school administrators in their own school.
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
- Selects a child before sending a message. The parent can message teachers or school administrators at that child's school.
- Parent messages are sent by the parent's account and clearly identify that the sender is a parent. The selected child is recorded as the context for the message.
- Cannot message other parents or students.

## 4. Direct-message permissions

| Sender | Permitted recipients |
|---|---|
| Teacher | Students, parents, and school administrators in the teacher's school |
| High-school student | Teachers and school administrators in the student's school |
| Parent | Teachers and school administrators at the selected child's school |
| School administrator or vice-administrator | Superadmin, for platform or system issues |
| Superadmin | School administrators and vice-administrators, for platform or system issues |

Recipient search and message submission must both enforce these rules. Hiding an unavailable recipient in the interface is not sufficient authorization. Messages between teachers, between students, between parents, and between students and parents are not permitted.

## 5. Announcements

- Teachers can target one or multiple classes they teach.
- Announcements are visible to the students and parents associated with the targeted class or classes.
- Announcement read receipts are not included.
- Announcement attachments are included as a carry-forward feature from the existing project.

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
- Users can update their own profile information after signing in.
- School staff members (school administrators, vice-administrators, and teachers) have a staff profile storing their required first name and last name, while their school linkage is handled via school membership. Superadmin, parent, and student accounts do not use a staff profile.
- Parent profiles store the parent's first and last name, referencing a `UserAccount` with the `PARENT` role. Shared contact details remain in `UserAccount`.
- Student profiles store minimal student data: first name, last name, school number, school, classroom, active/inactive enrollment status, parent association, and student login account reference (for high-school students). Date of birth, home address, and national identity numbers are not collected. Grade level is derived from the assigned classroom.
- When a student leaves a school, their student profile is marked inactive/archived rather than deleted. Any linked high-school student login account is deactivated. Enrolling at another school creates a new student profile under that school and links the existing parent account when applicable.
- Every user account has exactly one role. A single account cannot combine roles. If one person needs both teacher and parent access, they use two separate accounts with separate usernames and credentials. A student login account cannot also be a parent account.
- A parent account may be linked to multiple students, including students from different schools. A student has at most one linked parent account in the first version.

## 7. Message status

Direct messages support read/unread status. This is separate from announcement read receipts, which are excluded from the first version.

## 8. Non-goals

- System audit-log screens and a full audit trail.
- Multiple parent/guardian accounts accessing the same student.
- Student-to-student, parent-to-parent, teacher-to-teacher, or student-to-parent direct messaging.
- Grades, attendance, exams, and timetables.
- Academic-year tracking and multi-year classroom history.
- Automatic student promotion, student school transfer workflows, and academic-year processing.
- Collection of student date of birth, home address, or national identity number.

## 9. Decisions to confirm during detailed design

- The exact profile fields each role may view and edit.

## 10. Language

English is the required language for the project documentation and initial application interface because the course is taught in English. Turkish interface support may be added later.

## 11. School levels and student login

The platform treats school level as one of three distinct values. Each school record represents exactly one level. If a broader institution operates multiple levels, each level is represented as a separate school record (for example, Aktürk Primary School and Aktürk Middle School):

- **Primary school:** grades 1–4. Students do not sign in; their parent accesses their view. Parent association is required.
- **Middle school:** grades 5–8. Students do not sign in; their parent accesses their view. Parent association is required.
- **High school:** grades 9–12. Every student receives a student login account upon enrollment. A parent may also be linked to the student profile if requested by the parent.

A student's current grade is derived from their assigned classroom and must be valid for the school's level. A student number is unique within its school. A username is unique across the whole platform. A parent account may be linked to children at different schools and switches to a child's view after selecting that child.

## 12. School identification

School names are not unique across the platform. Every school has a unique system-generated internal ID. School selection screens should display the school name together with its province/city and district so that similarly named schools can be distinguished. A user-managed school code is not required.
