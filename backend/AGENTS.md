# Backend

The HTTP interface is the test seam. Exercise it with Flask's test client and a migrated temporary SQLite database.

- Keep authentication behavior in `auth.py` and todo behavior in `todos.py`; avoid pass-through layers.
- Every todo query is scoped to the current user and excludes soft-deleted rows.
- Return `404` for absent, deleted, and differently-owned todo IDs.
- Apply CSRF protection to every state-changing route, including authentication.
- Add schema changes through Alembic migrations.

Backend work is complete when `make backend-check` passes from the repository root.

