# EduConnect — Project Scope

**Document status:** Initial scope draft (v0.1)  
**Document language:** English  
**Product type:** Multi-tenant school communication and announcement platform

## 1. Project purpose

EduConnect helps schools communicate announcements to the right students and families in one place. It reduces the chance that parents miss important school information because it is spread across multiple messaging groups. The platform supports multiple schools, with each school managing its own users, classes, and communication.

## 2. Product boundaries

The first version focuses on school administration, class-based announcements, and direct communication between permitted users. It is not intended to be a full school information system. Grading, attendance tracking, exams, and timetables are outside the initial scope.

The first version carries forward the existing project's main capabilities: school and account administration, class management, role-specific dashboards, announcements, announcement attachments, direct messages, and profile updates. System audit logs are deferred.

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

- Only high-school students sign in with their own accounts.
- Can view announcements and send direct messages to teachers or school administrators in their own school.
- Cannot message other students or parents.
- Primary- and middle-school students do not sign in. Their parent accesses the student's information through the parent's account.

### 3.5 Parent

- Signs in with a parent account and can access one or more linked children.
- Can select a child to enter that child's view, return to the parent's own profile, or switch to another linked child without signing out.
- Can update the parent's own profile independently of the selected child's view.
- Can access a high-school student's information as well as younger students' information.
- For the first version, each student is linked to one parent account for access. Supporting multiple parent/guardian accounts for one student is deferred.
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

Recipient search and message submission must both enforce these rules. Hiding an unavailable recipient in the interface is not sufficient authorization. Messages between teachers, between students, between parents, and between students and parents are not permitted in the first version.

## 5. Announcements

- Teachers can target one or multiple classes they teach.
- Announcements are visible to the students and parents associated with the targeted class or classes.
- Announcement read receipts are not included in the first version.
- Announcement attachments are included as a carry-forward feature from the existing project.

## 6. Accounts and profiles

- There is no public self-registration in the normal user flow.
- The Superadmin creates school administrator accounts; each school administrator can create accounts for that school.
- Users can update their own profile information after signing in.
- The interface may show a first-login reminder to review account information. Whether a password change must be enforced at first login remains to be decided.

## 7. Message status

Direct messages support read/unread status. This is separate from announcement read receipts, which are excluded from the first version.

## 8. Initial non-goals

- System audit-log screens and a full audit trail.
- Multiple parent/guardian accounts accessing the same student.
- Student-to-student, parent-to-parent, teacher-to-teacher, or student-to-parent direct messaging.
- Grades, attendance, exams, and timetables.

## 9. Decisions to confirm during detailed design

- Whether first login requires a password change or only displays a reminder.
- The exact profile fields each role may view and edit.

## 10. Language

English is the required language for the project documentation and initial application interface because the course is taught in English. Turkish interface support may be added later.
