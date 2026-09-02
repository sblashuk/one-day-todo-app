# Frontend

The rendered user interface is the test seam. Assert visible behavior and accessibility roles; mock only the typed HTTP client.

- Keep request construction, CSRF headers, response parsing, and error normalization in `src/api/`.
- Treat server responses as authoritative and reload todos after every successful mutation.
- Give every asynchronous state an accessible loading, pending, empty, or error presentation.

## Context pointers

- Visual design: read `DESIGN.md` when changing styling, layout, responsive behavior, or UI components.

Frontend work is complete when `make fe-check` passes from the repository root.
