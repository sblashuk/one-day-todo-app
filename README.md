# Daylist

Daylist is a focused, full-stack todo app built as a one-day MVP. Each account gets a private list where todos can be added, marked active or completed, and removed through soft deletion.

## What is included

- Flask application factory with session authentication and CSRF protection
- SQLAlchemy models, SQLite persistence, and Alembic migrations
- React, strict TypeScript, Vite, and Tailwind CSS
- Responsive authentication, loading, empty, validation, failure, and todo states
- Backend HTTP-interface tests and frontend rendered-interface tests
- Docker Compose development environment and GitHub Actions checks

Password reset, email verification, account administration, todo editing, filters, restore controls, production deployment, and browser E2E tests are intentionally outside this MVP.

## Start with Docker

Requirements: Docker with Compose.

```bash
cp .env.example .env
# Replace SECRET_KEY in .env with a random value.
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173). The backend health endpoint is available at [http://localhost:5000/api/health](http://localhost:5000/api/health). SQLite data is retained in the `todo-data` volume.

## Start locally

Requirements: Python 3.14 and Node.js 24.

```bash
make setup
export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex())')"
make migrate
```

Start the backend and frontend in separate terminals:

```bash
cd backend
../.venv/bin/flask --app todo_app run --debug
```

```bash
cd frontend
npm run dev
```

The local SQLite file is created beneath `backend/instance/`. Vite proxies browser requests under `/api` to Flask, so no development CORS configuration is required.

## Verification

```bash
make check
```

Useful focused commands are discoverable with `make -qp` and in the root `Makefile`. The complete check runs backend lint/tests plus frontend lint, typechecking, tests, and production build.

## HTTP interface

All state-changing requests require the `X-CSRFToken` value returned by `GET /api/auth/session`.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/auth/session` | Return the current user and CSRF token |
| `POST` | `/api/auth/register` | Create an account and sign in |
| `POST` | `/api/auth/login` | Sign in with email and password |
| `POST` | `/api/auth/logout` | End the browser session |
| `GET` | `/api/todos` | List the current user's visible todos |
| `POST` | `/api/todos` | Add a todo |
| `PATCH` | `/api/todos/:id` | Set its completed state |
| `DELETE` | `/api/todos/:id` | Soft-delete it |

Errors use `{ "error": { "code", "message", "fields"? } }`. Missing, deleted, and differently-owned todo IDs all return `404`.

## Project guidance and skills

The root and scoped `AGENTS.md` files capture architectural invariants and completion criteria. `skills-lock.json` is the inventory source of truth for the installed project skills; the current set includes `ask-matt`, `code-review`, `codebase-design`, `grill-me`, `grill-with-docs`, `improve-codebase-architecture`, `tdd`, and `writing-for-agents`.

The main design seam is the Flask HTTP interface. Authentication and todo modules hide hashing, sessions, CSRF, ownership, validation, queries, and transactions behind it. The frontend HTTP client forms the network seam and keeps request mechanics out of the rendered interface.
