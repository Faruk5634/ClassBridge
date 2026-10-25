# ClassBridge frontend

The frontend is the React and TypeScript single-page application for the teacher, student, and parent workspaces. It uses Vite for local development and proxies `/api` requests to the local Spring Boot backend at `http://localhost:8080`.

From this directory:

- `npm install` installs the frontend dependencies.
- `npm run dev` starts the local development server.
- `npm run build` type-checks and creates a production bundle.
- `npm run lint` runs Oxlint.

See the [repository README](../README.md) and [project documentation](../docs/PROJECT_SCOPE.md) for setup, product behavior, and current launch-readiness limits.
