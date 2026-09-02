# User activity profile and completion calendar

Status: ready-for-agent

## Problem Statement

People using Daylist can see which todos are currently complete, but they cannot see their completion activity over time. The account identity is confined to the top bar, and there is no profile view that turns finished work into a useful historical pattern.

Using a todo's `updated_at` timestamp for that history would be misleading. Editing, reopening, or deleting a todo changes that timestamp, so past activity could move between dates or disappear. Completion history needs a meaning that remains stable even while the todo continues to change.

## Solution

Add an authenticated `/profile` page that presents the user's full account email and a calm, Daylist-styled activity calendar. The calendar shows the current week and the preceding eleven weeks as columns, with Monday through Sunday as rows. Each date's color intensity communicates how many todos were completed that day, using fixed thresholds and the existing paper, sage, forest, and dark-forest palette.

Completion activity is backed by immutable completion events rather than mutable todo timestamps. Each incomplete-to-complete transition records one event. Reopening or soft-deleting the todo leaves earlier events intact, and completing a reopened todo records another event. Existing completed todos receive one approximate historical event based on their current `updated_at` during migration.

The profile loads completion timestamps for the visible interval and groups them into calendar dates using the viewing device's local timezone. A user can hover, tap, or use the keyboard to inspect a date's exact count in a tooltip. Todo titles are not exposed in this view.

## User Stories

1. As a signed-in Daylist user, I want to open my profile from the account email in the top bar, so that I can review my completion activity.
2. As a signed-in Daylist user, I want my profile to have the stable `/profile` URL, so that browser navigation behaves like navigation between pages.
3. As a signed-in Daylist user, I want to return from my profile to Today, so that I can continue managing my current list.
4. As a signed-in Daylist user, I want to see my full account email on my profile, so that I know which account's history I am viewing.
5. As a signed-out visitor opening `/profile`, I want to be asked to authenticate, so that private activity is not exposed.
6. As a user who authenticates while visiting `/profile`, I want to arrive at the profile afterward, so that my original destination is preserved.
7. As a signed-in Daylist user, I want to see twelve weeks of completion activity, so that I can recognize recent patterns without navigating a full year.
8. As a signed-in Daylist user, I want weeks arranged as columns, so that the calendar follows the familiar contribution-calendar pattern.
9. As a signed-in Daylist user, I want each week ordered from Monday through Sunday, so that the calendar matches the app's agreed weekly rhythm.
10. As a signed-in Daylist user, I want the current partial week included, so that today's completions appear immediately.
11. As a signed-in Daylist user, I want future dates in the current week to be visibly unavailable, so that empty future days are not mistaken for missed activity.
12. As a signed-in Daylist user, I want month labels aligned with the relevant week columns, so that I can orient dates quickly.
13. As a signed-in Daylist user, I want days with no completions to use the neutral paper treatment, so that actual activity is easy to distinguish.
14. As a signed-in Daylist user, I want days with one, two, three, and four-or-more completions to use progressively stronger colors, so that workload density is visible at a glance.
15. As a signed-in Daylist user, I want the color thresholds to remain fixed, so that the same shade keeps the same meaning over time.
16. As a signed-in Daylist user, I want a Less-to-More legend, so that the color scale is understandable without guessing.
17. As a signed-in Daylist user, I want today to have a restrained coral marker or focus treatment, so that I can find it without confusing it with activity intensity.
18. As a pointer user, I want to hover a calendar day to see its full date and completion count, so that I can inspect the heatmap precisely.
19. As a touch user, I want to tap a calendar day to see its full date and completion count, so that the calendar remains useful without hover.
20. As a keyboard user, I want to focus the calendar once and move between dates with arrow keys, so that inspecting the chart does not require tabbing through 84 cells.
21. As a keyboard user, I want left and right movement to follow week columns and up and down movement to follow adjacent weekdays, so that focus matches the visible grid.
22. As a screen-reader user, I want the active date and count announced in text, so that color is never the only source of information.
23. As a user who has completed no todos in the visible period, I want a clear empty presentation, so that an all-neutral calendar is not mistaken for a loading failure.
24. As a user opening the profile on a slow connection, I want an accessible loading state, so that I know the history is being retrieved.
25. As a user whose activity fails to load, I want a concise error and retry action, so that I can recover without leaving the profile.
26. As a user on a narrow mobile screen, I want all twelve weeks to remain legible without ordinary page-level horizontal scrolling, so that the profile works at the app's 320px minimum width.
27. As a user who prefers reduced motion, I want the profile to remain understandable without decorative animation, so that motion preferences are respected.
28. As a user completing a todo, I want that completion recorded on the date I experienced locally, so that the calendar matches my day near midnight.
29. As a user editing an already-completed todo, I want its historical completion to remain on the original date, so that unrelated edits cannot rewrite my activity.
30. As a user reopening a completed todo, I want its earlier completion to remain in history, so that undoing the current state does not erase work already done.
31. As a user completing a reopened todo, I want a new completion recorded, so that each genuine incomplete-to-complete transition contributes to activity.
32. As a user submitting the same completed state more than once, I want only the first state transition recorded, so that retries or redundant updates do not inflate activity.
33. As a user soft-deleting a completed todo, I want its completion activity retained, so that housekeeping does not alter historical totals.
34. As a user with completed todos from before this feature, I want approximate entries backfilled, so that my calendar does not start artificially empty after deployment.
35. As a signed-in user, I want to see only my own completion history, so that another account's activity remains private.
36. As a user viewing the calendar on another device, I want dates grouped using that device's local timezone, so that the profile follows the timezone of the current viewing context.
37. As a privacy-conscious user, I want calendar tooltips to show only dates and counts, so that todo titles are not revealed by the activity view.
38. As a Daylist user, I want the profile to use the same editorial typography, spacing, shapes, and colors as Today, so that it feels like part of one product.

## Implementation Decisions

- The profile is an authenticated browser route at `/profile`; Today remains at `/`. Use client-side routing with browser history semantics rather than an in-memory view toggle.
- The existing account email is the profile identity. This feature does not introduce a username or display-name field and does not modify registration credentials.
- The top-bar email becomes the profile navigation control. The profile provides a clearly named route back to Today and retains the existing sign-out behavior.
- Introduce the domain concept `CompletionEvent`: an immutable, user-owned record of a todo's incomplete-to-complete transition. Record its identifier, owning user, source todo, and UTC completion timestamp.
- Create completion events within the same database transaction as the todo state change. Create an event only when persisted state changes from `false` to `true`; redundant `true` updates create none. Changes from `true` to `false` and soft deletion never remove events.
- Add an index supporting completion-event lookup by user and timestamp. Preserve ownership explicitly on the event so activity queries can remain directly user-scoped.
- Add a migration for completion-event storage. During upgrade, insert one event for each currently completed todo using that todo's `updated_at` as the best available legacy approximation. This approximation applies only to backfilled data; new activity always uses the transition time.
- Add an authenticated read-only HTTP interface at `GET /api/activity/completions`. It accepts required `from` and `to` timestamps with timezones, treats `from` as inclusive and `to` as exclusive, rejects malformed or reversed ranges with the standard validation-error envelope, and returns only the current user's completion timestamps in chronological order.
- The activity response is `{ "completions": [{ "completedAt": <UTC ISO-8601 timestamp> }] }`. It intentionally omits todo titles and other todo details.
- The frontend HTTP client owns query construction, response parsing, and normalized failures. The rendered profile consumes typed completion activity and contains no request mechanics.
- The frontend determines the twelve-week interval from device-local dates. The first visible day is Monday eleven weeks before the current week; the last visible day is Sunday of the current week. Request bounds are the corresponding local midnights converted to UTC, with the end bound set to the midnight after the last visible day so daylight-saving transitions are handled by local date construction.
- The frontend converts each returned UTC timestamp back to a device-local `ActivityDay` and aggregates event counts by local `YYYY-MM-DD`. One event contributes exactly one count; multiple events for the same todo and date count separately when they represent separate completion transitions.
- The `ActivityCalendar` always contains twelve week columns and seven Monday-to-Sunday rows. Days after the current local date are rendered as unavailable and are not inspectable activity days.
- Density levels are fixed: zero completions, one completion, two completions, three completions, and four-or-more completions. Use existing neutral and green app colors; reserve coral for today and focus emphasis rather than density.
- The calendar provides month labels and a textual Less-to-More legend. Date/count text accompanies all inspectable states so the design does not rely on color alone.
- The calendar is one keyboard tab stop. It tracks an active `ActivityDay`; pointer hover, touch selection, and arrow-key navigation update that active day and the visible tooltip. Vertical movement changes adjacent weekdays and horizontal movement changes week columns, while navigation stays inside the available date range.
- Profile-specific asynchronous behavior includes an accessible initial loading state, a no-activity message, and a retryable error state. Activity is loaded when the authenticated profile route is entered.
- The visual treatment extends Daylist's existing warm editorial language: paper canvas, softly raised card, display-serif profile heading, restrained labels, sage-to-forest density, and generous whitespace. It must remain usable at the existing 320px minimum viewport and respect visible focus and reduced-motion preferences.
- Add domain documentation defining `CompletionEvent`, `ActivityDay`, and `ActivityCalendar`. Add an architectural decision record explaining why immutable completion events were selected over `updated_at`, including the legacy approximation and additional storage/query consequences.

## Testing Decisions

- Tests assert behavior through the repo's two established seams: Flask HTTP behavior and the rendered React user interface. They do not query persistence as a side channel, test private helpers, or couple assertions to internal module composition.
- Flask HTTP tests cover authentication, standard validation errors, inclusive/exclusive range behavior, chronological response ordering, user isolation, initial completion, redundant completed updates, reopen-and-recomplete behavior, and retained activity after soft deletion.
- The migration is exercised with the real migration chain. A legacy completed todo is upgraded and then observed through the authenticated activity HTTP interface, establishing that backfilled activity is externally visible without making model internals the behavioral assertion surface.
- Rendered React tests cover navigation to and from `/profile`, direct-route authentication behavior, full email presentation, loading, empty, error, and retry states.
- Rendered calendar tests assert twelve week columns, seven Monday-first rows, current partial-week handling, future unavailable days, month labels, fixed density classes or accessible level descriptions, legend copy, and the date/count tooltip.
- Local-time behavior is tested at the rendered seam by generating UTC timestamps from known local `Date` values, ensuring events on either side of local midnight appear on the expected visual dates without assuming the test runner's timezone.
- Interaction tests cover pointer hover, touch/click selection, one-stop keyboard focus, arrow-key movement matching the column/row layout, bounds behavior, and the active date/count announcement.
- Accessibility assertions use roles, names, state, focus, and visible recovery behavior. Styling implementation details are asserted only where the fixed density level is itself part of the user-visible contract.
- Frontend HTTP-client tests follow the existing request-client prior art and verify encoded range parameters plus response parsing while leaving rendering tests free to mock only the typed client.
- Existing todo mutation and session tests remain the prior art for backend ownership, authentication, CSRF, error envelopes, authoritative refetch behavior, and React client mocking.
- Completion requires the repository-wide `make check` command to pass.

## Out of Scope

- Adding a separate username, editable display name, avatar, biography, or other account settings.
- Showing todo titles, priorities, due dates, or per-day task lists in the profile.
- Filtering, paging, or navigating beyond the fixed twelve-week window.
- A full-year heatmap, custom date ranges, streak calculations, achievements, comparisons, or productivity scoring.
- A saved account timezone or timezone selector; grouping follows the current viewing device.
- Editing or deleting individual completion events.
- Recovering completion transitions that cannot be inferred from the current pre-migration todo state. Backfill supplies at most one approximate event per currently completed todo.
- Recording todo creation, edits, reopening, deletion, or other mutations as activity events.
- Public profiles, sharing, cross-user views, or administrative activity access.
- Live push updates while the profile remains open; re-entering or reloading the profile retrieves authoritative activity.

## Further Notes

- `updated_at` remains useful as the timestamp of the todo's latest mutation, but it must not be described or consumed as a completion timestamp after this feature.
- Historical backfill is explicitly approximate because an existing completed todo may have been edited after completion. The migration preserves the best available signal without pretending it is exact.
- The calendar's visual inspiration is GitHub's contribution calendar, but its weekly orientation, palette, typography, focus treatment, and copy should remain recognizably Daylist.
- Domain-doc and ADR creation were identified during the requested grilling/domain-modeling workflow and are part of this feature, not optional follow-up documentation.
