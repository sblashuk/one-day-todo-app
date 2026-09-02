# ADR-0001: Preserve completion history as immutable events

Status: accepted

## Context

The profile needs stable completion counts by date. A Todo's `updated_at` changes when the Todo is edited, reopened, or soft-deleted, so treating it as a completion timestamp would move or erase past activity. Repeated incomplete-to-complete transitions must also remain independently countable.

## Decision

Record a `CompletionEvent` in the same database transaction whenever persisted Todo state changes from incomplete to complete. Store the owning user, source Todo, and UTC completion timestamp on the event. Query activity directly by owning user and timestamp; return timestamps only, leaving device-local date grouping to the frontend.

Reopening, editing, and soft deletion do not mutate or remove prior events. A later incomplete-to-complete transition creates another event. Redundant completed updates create none.

The migration backfills one approximate event for every Todo that is completed at upgrade time, using that Todo's current `updated_at`. This is explicitly a legacy approximation and is not used for new events.

## Consequences

- Completion history remains stable independently of mutable Todo state.
- Each genuine transition can be counted, including recompletion after reopening.
- Activity queries stay directly user-scoped and do not expose Todo titles.
- The system stores an additional append-only row per completion transition and maintains an index on user and completion time.
- Pre-feature history cannot be reconstructed exactly; only currently completed Todos receive one approximate event.
