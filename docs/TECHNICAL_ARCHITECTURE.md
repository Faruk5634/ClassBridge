# EduConnect — Technical Architecture

**Document status:** Initial architecture draft (v0.1)  
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
EduConnect/
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

- Users sign in with accounts created by an authorized administrator; public self-registration is not part of the normal flow.
- Users authenticate with their username and password against the `UserAccount` record. Only active accounts may authenticate, and passwords are verified against their stored one-way hashes.
- Spring Security protects the REST API using signed JWT bearer access tokens with a 15-minute lifetime. Refresh tokens are out of scope for the first version.
- The JWT signing secret is supplied through a local, uncommitted environment variable named `JWT_SECRET`. The application must not provide a default secret, log the secret, or commit it to version control.
- Backend authorization checks the user's role and school membership for every protected operation.
- Direct-message recipient rules are enforced on the backend, including the selected-child context for parent messages.
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
- No records, tables, or database files are migrated or imported from the previous EduConnect project.
- Local development uses a separate database name and configuration from the existing project so existing data remains untouched.
- Schema changes should be versioned as migration scripts so that a clean database can be created reproducibly.
- Only intentional new development or demonstration records may be added to the new database.

## 8. File attachments

Announcement attachments remain in scope. The storage implementation will be selected during detailed design. File metadata and authorization must be handled by the backend, and access must respect the announcement's school and audience.

## 9. Quality and delivery principles

- Keep the implementation small and understandable for an individual graduation project.
- Document requirements and architecture in English to match the course language.
- Build and verify one vertical feature at a time: database model, API, authorization, and user interface.
- Avoid claiming security properties such as tenant isolation until they are implemented and verified.
- Deployment and public publishing are deferred; local development comes first.

## 10. Decisions for detailed design

- Choose the exact migration tool and local PostgreSQL setup when initializing the new repository.
- Decide whether attachments are stored on the local development filesystem initially or through an external object-storage service.
- Confirm whether a first-login password change is mandatory or whether users receive a reminder.
