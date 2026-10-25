# ClassBridge

ClassBridge is a multi-school communication application for school staff, students, and parents. It provides role-specific workspaces, class announcements with private attachments, in-app conversations, and account profile settings. The management workspace is still being developed; this repository is not yet a production deployment.

## Project layout

- `backend/` — Java 17, Spring Boot, Spring Security, PostgreSQL, and Flyway.
- `frontend/` — React, TypeScript, and Vite single-page application.
- `docs/` — active product scope, data model, and technical architecture.

## Local development

Prerequisites: Java 17 or later, Node.js compatible with Vite 8, npm, and PostgreSQL.

1. Create a local PostgreSQL database named `classbridge_dev` (or choose another name in `DB_URL`).
2. Set `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, and `JWT_SECRET` in the backend process environment. `JWT_SECRET` must be Base64-encoded random bytes and decode to at least 32 bytes. Do not commit secrets.
3. Optionally set `BOOTSTRAP_SUPERADMIN_USERNAME` and `BOOTSTRAP_SUPERADMIN_PASSWORD` to create the initial Superadmin on an empty database. The password is stored as a BCrypt hash.
4. Start the backend from `backend/` with `./mvnw spring-boot:run` (macOS/Linux) or `./mvnw.cmd spring-boot:run` (Windows).
5. Start the frontend from `frontend/` with `npm install` and `npm run dev`.

Flyway applies database migrations when the backend starts. Local attachment bytes are stored outside the repository in `${user.home}/.classbridge/attachments` by default; set `CLASSBRIDGE_ATTACHMENT_STORAGE_DIR` to use a different local directory.

## Checks

- Frontend production build: `npm run build` from `frontend/`.
- Frontend lint: `npm run lint` from `frontend/`.
- Backend tests: `./mvnw test` from `backend/` (Windows: `./mvnw.cmd test`). The backend requires a reachable configured PostgreSQL database and a valid `JWT_SECRET` for application-context tests.

## Product and security notes

The backend is authoritative for role, school, class, parent-child, and conversation access. Read [Project Scope](docs/PROJECT_SCOPE.md), [Data Model](docs/DATA_MODEL.md), and [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md) for the current product rules and technical boundaries.

Before a public SaaS launch, production-specific work remains: HTTPS termination, managed secrets, rate limiting and abuse monitoring, backups and restore drills, operational logging/monitoring, dependency and security scans, and automated multi-tenant authorization tests. Local file storage must also be replaced or operationally managed for a multi-instance deployment.
