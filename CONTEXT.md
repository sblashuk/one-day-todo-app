# Daylist domain

Daylist is a private, single-day todo list. Each authenticated user owns their todos and their historical completion activity.

## Glossary

### Todo

A user-owned item on the current list. A Todo has a title, optional due date and priority, current completion state, and soft-deletion state. Editing, reopening, and soft-deleting a Todo are mutations of its current state; they do not revise completion history.

### CompletionEvent

An immutable, user-owned record that a Todo changed from incomplete to complete. Each event identifies its source Todo and records the transition time in UTC. A redundant completed update creates no event; reopening preserves prior events; completing again after reopening creates another event.

### ActivityDay

A device-local calendar date paired with the number of CompletionEvents whose UTC timestamps fall on that date in the viewing device's timezone. It contains no Todo details.

### ActivityCalendar

The fixed twelve-week view of ActivityDays shown on the profile. Weeks are columns, weekdays run Monday through Sunday, the current partial week is included, and future dates are unavailable.
