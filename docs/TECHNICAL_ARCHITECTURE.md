# ClassBridge — Technical Architecture

**Document status:** Active
**Document language:** English

## 1. Technology choices

- Backend: Java 17 and Spring Boot.
- Frontend: React, TypeScript, and Tailwind CSS.
- Database: PostgreSQL.
- Backend and frontend are separate applications in one repository.
- The initial application interface and project documentation are in English. Turkish may be added later through localization.

Exact framework and dependency versions will be selected when the new project is initialized and recorded in the project build files.

## 2. Repository layout

```text
ClassBridge/
├── backend/
│   ├── pom.xml
│   └── src/
├── frontend/
│   ├── package.json
│   └── src/
├── docs/
│   ├── PROJECT_SCOPE.md
│   ├── DATA_MODEL.md
│   └── TECHNICAL_ARCHITECTURE.md
└── README.md
```

The backend and frontend are normal directories within the same Git repository, not nested Git repositories or submodules.

## 3. Backend structure

The backend uses a layered structure so that HTTP handling, business rules, persistence, and API models have clear responsibilities.

```text
backend/src/main/java/.../
├── config/          # Application and API configuration
├── security/        # Authentication, authorization, and tenant context
├── controller/      # REST endpoints
├── service/         # Business rules and use cases
├── repository/      # Database access
├── domain/          # Persistent business entities and enums
├── dto/             # Request and response models
├── mapper/          # Domain-to-API conversions
└── exception/       # Consistent error handling
```

The REST API is the interface between the backend and the React application. Controllers validate and route requests; services enforce application rules; repositories perform database access.

## 4. Frontend structure

The frontend is a React single-page application written in TypeScript. UI areas are organized by shared components and user workflows, with role-specific pages for Superadmin, school administrators, teachers, students, and parents. The frontend does not decide access permissions by itself; the backend remains authoritative.

## 5. Authentication and authorization

- Users sign in with accounts created by an authorized administrator; public self-registration is not part of the normal flow. Each account has exactly one role.
- Users authenticate with their username and password against the `UserAccount` record. Only active accounts may authenticate, and passwords are verified against their stored one-way hashes.
- Whenever an authorized administrator creates a login-enabled account, the system generates a cryptographically secure random initial password.
- That initial password is returned exactly once in the successful account-creation response to the administrator who created the account: to the Superadmin for school administrator and vice-administrator accounts, and to the school administrator or vice-administrator for teacher, parent, and high-school student accounts.
- When enrolling a student whose parent does not yet have an account, school staff create a new parent account using this initial credential flow. If the parent already has an account, staff link the student using the parent's existing globally unique username without generating new credentials.
- Every high-school student receives a login account with the `STUDENT` role upon enrollment, with an initial password generated under this same policy. Primary- and middle-school students do not have login accounts.
- Deactivated accounts (such as a high-school student account deactivated after leaving a school) cannot authenticate.
- The backend persists only the BCrypt hash. Never log or store the plain-text password in the database, project files, or other persistent storage.
- If the successful creation response is lost, the initial password cannot be retrieved; an authorized password-reset flow is required.
- Users are not forced to change the initial password on first login. The interface may show an informational reminder about reviewing account credentials, but it must not block the user from continuing.
- Users may change their password after signing in through `POST /api/auth/change-password`. The request requires the current password and a new password of 8–20 characters; the new password must also fit BCrypt's 72-byte UTF-8 limit. The current password is verified before the new BCrypt hash is saved. The endpoint applies to every active role and never returns or logs either password.
- Password changes do not revoke already-issued JWTs in the first version; those tokens remain usable until their normal 15-minute expiration. The user can sign in with the new password to obtain a fresh token.
- Email and phone number remain optional account contact fields. `POST /api/auth/email-verification/request` sends a six-digit verification code to the authenticated account's current email; the authenticated account submits it to `POST /api/auth/email-verification/confirm`. Self-service recovery uses only a verified email address in the first version; SMS can be added later.
- An authenticated user can set or change the email with `PUT /api/auth/email`. A changed address is marked unverified, and outstanding verification and recovery codes are invalidated until the new address is confirmed.
- Authenticated users can read their own role-aware profile from `GET /api/auth/me` and update their own nonblank phone number with `PUT /api/auth/phone`. The profile response includes the authenticated account's safe identity and contact fields only; it never exposes password hashes, recovery codes, or credential-version data. Self-service cannot change names, username, role, or school association. Student profile corrections remain restricted to school administrators and vice-administrators in the student's school.
- `POST /api/auth/password-reset/request` accepts an email address and always returns the same generic response for an existing or nonexistent eligible account. Only a single active account with that verified email receives a code. Requests are rate-limited per account.
- `POST /api/auth/password-reset/confirm` accepts the verified email, a valid six-digit code, and a new password. Recovery codes are cryptographically random, single-use, expire after 30 minutes, are stored only as BCrypt hashes, and allow at most five confirmation attempts. Emails use a branded HTML template with a plain-text alternative. Successful recovery increments the account's `credentialVersion`; bearer-token validation checks this claim on every request, immediately invalidating older tokens.
- Accounts without a verified email use an authorized administrator-assisted reset flow; SMS is deferred. SMTP configuration is supplied through local environment variables (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_FROM`) and must not be committed.
- `POST /api/superadmin/accounts/{accountId}/password-reset` lets a Superadmin reset an active school administrator or vice-administrator account. `POST /api/school-admin/accounts/{accountId}/password-reset` is limited to eligible accounts in the authenticated administrator's school (teachers, active students, and parents linked to an active student there). Each operation replaces the password with a generated temporary credential, returns it once to the caller, and increments `credentialVersion` so prior JWTs stop working. A parent account shared across schools remains one account, so its reset affects sign-in across all linked schools.
- Spring Security protects the REST API using signed JWT bearer access tokens with a 15-minute lifetime. Refresh tokens are out of scope.
- The JWT signing secret is supplied through a local, uncommitted environment variable named `JWT_SECRET` and must be a Base64-encoded random key of at least 32 bytes. The application uses HS256 for signing and verification. The application must not provide a default secret, log the secret, or commit it to version control.
- **Active-account and credential-version validation on bearer tokens:** During every authenticated request, token validation (`ActiveUserAccountTokenValidator`) checks the JWT subject ID, active status, role, and `credential_version` against the account record. Missing, inactive, mismatched, or stale tokens are rejected with HTTP 401 Unauthorized without leaking account details. Existing issuer, signature, expiration, and role-authority checks remain intact.
- Backend authorization checks the user's role and school membership for every protected operation.
- Direct messaging uses asynchronous, text-only conversations with no subject, real-time delivery, email, or push notification in the first version. Replies are stored in the same conversation; a new start by the same participants creates a separate conversation. Backend authorization covers recipient discovery, conversation creation, every reply, read/unread updates, and selected-child context.
- Teachers and school administrators/vice-administrators may message active students in their own school; teachers do not need a classroom assignment to the student. Staff never directly select a parent as a recipient. Primary/middle-school student-context conversations use the linked parent account as the actual recipient, while high-school conversations use the student's account.
- Parents select a linked child and may message teachers or school administrators/vice-administrators only in that child's school. For primary/middle school, parents can reply to staff-started conversations. For high school, a parent can read student/staff conversations but cannot reply, and this read-only access does not clear the student's unread status; parent-started conversations are separate, parent-authored, and not visible to the student. The parent is never represented as the student.
- Teachers and school administrators/vice-administrators may message one another only within the same school. Superadmin support conversations are limited to Superadmin and school administrators/vice-administrators, retaining the relevant school context. School administrators and vice-administrators have equal messaging permissions in the first version.
- Database credentials and other secrets are supplied through local environment configuration and are not committed to Git.

The first Superadmin must be provisioned through a controlled setup process:
- The backend uses local environment variables named `BOOTSTRAP_SUPERADMIN_USERNAME` and `BOOTSTRAP_SUPERADMIN_PASSWORD`.
- During startup, the application creates a Superadmin only when the database contains no Superadmin and both variables are configured.
- The supplied password is hashed before being stored. The plain-text password is never logged or persisted in project files.
- If a Superadmin already exists, the application does not create another one and does not overwrite its username or password from the environment variables.
- If the database is reset and the account is gone, the same configured bootstrap credentials recreate it. Note that the recreated account will use the bootstrap password, even if its password was changed after the original bootstrap.
- Bootstrap variables remain in local, uncommitted configuration. There are no default credentials or public Superadmin registration endpoints.

## 6. Multi-tenant data isolation

The initial design uses one PostgreSQL database with shared tables for multiple schools. School-owned records carry a school relationship, and backend queries and authorization rules scope access to the current school. Superadmin operations are platform-wide and are explicitly authorized.

Parent access is derived from the parent's linked student profiles. A parent may have children at different schools, so the parent account itself is not limited to a single school. When acting in a child's view or sending a message, the selected child supplies the school context. The backend verifies that the selected child is linked to that parent.

Tenant isolation is a security requirement and must be verified with automated tests before the project is considered complete.

## 7. Database lifecycle

- The new application starts with a clean PostgreSQL database and a schema created for the new implementation.
- No records, tables, or database files are migrated or imported from any previous projects.
- Local development uses a separate database name and configuration from the existing project so existing data remains untouched.
- Schema changes should be versioned as migration scripts so that a clean database can be created reproducibly.
- Only intentional new development or demonstration records may be added to the new database.

## 8. File attachments

Announcement attachments use a local filesystem storage model with database-backed metadata:
- **Filesystem storage:** File bytes are stored on the local filesystem outside the repository. The storage directory defaults to `${user.home}/.classbridge/attachments` and can be overridden via the `CLASSBRIDGE_ATTACHMENT_STORAGE_DIR` environment variable. Physical directory paths and disk filenames are never exposed in API responses or served through static web routes.
- **Server-generated storage keys:** Each stored file is stored under a server-generated UUID storage key on disk, completely decoupling physical storage from original user filenames.
- **Database metadata:** PostgreSQL stores only attachment metadata (`announcement_attachments`: `id`, `announcement_id`, `storage_key`, `display_filename`, `content_type`, `file_size`, and `created_at`). File bytes are never stored in the database.
- **File limits and verification:** Attachments are restricted to PDF, JPEG, and PNG files with a 10 MB maximum file size limit. Validation requires matching magic byte content signatures as well as valid extensions and MIME types; Content-Type headers alone are not trusted.
- **Atomic write and failure cleanup:** Uploaded files are written to a temporary file in the storage directory before being atomically moved to their permanent UUID key. Transaction synchronizations and exception handlers ensure files are cleaned up immediately if disk operations, database persistence, or transaction commits fail.
- **Scoped access control:** Uploads require `SCHOOL_ADMIN` or `SCHOOL_VICE_ADMIN` (for any announcement in their school) or `TEACHER` (only for announcements they authored). Downloads are authorized for staff in the author's school, students in targeted active classrooms, and parents of active linked children in targeted classrooms. Archived profiles do not grant access, and missing or unauthorized combinations return HTTP 404 to avoid leaking cross-school or cross-class data.

## 9. Quality and delivery principles

- Keep the implementation small and understandable for an individual graduation project.
- Document requirements and architecture in English to match the course language.
- Build and verify one vertical feature at a time: database model, API, authorization, and user interface.
- Avoid claiming security properties such as tenant isolation until they are implemented and verified.
- Deployment and public publishing are deferred; local development comes first.

## 10. Decisions for detailed design

- The exact profile fields each role may view and edit.
