# R&J planner

A plain HTML, CSS, and JavaScript planner with Supabase authentication and syncing. No frontend build step is needed. Serve this directory with a static HTTP server and open index.html.

## Code map

| File | Responsibility |
| --- | --- |
| index.html | Page structure and script loading |
| styles.css | Shared styles, theme, and responsive layout |
| app.js | Bootstrap, shared state, DOM references, event wiring, task creation/completion, recurrence controls, and animations |
| task-edit.js | Edit form lifecycle, outside-click handling, and saving/moving tasks |
| task-lists.js | Personal/shared/partner list rendering and IRL drag surfaces |
| planner-time.js | Date normalization, recurrence calculations, and reset labels |
| sync.js | Authentication, pairing, local storage, and Supabase syncing |
| supabase-setup.sql | Database schema and access policies |

Start with the relevant file and search for the function name rather than reading the entire application.

## Loading and data contracts

These are classic scripts sharing the same global scope. Helper files contain function declarations only and must load before app.js, which initializes shared state and starts the app. Keep script tags in index.html in order; do not add async.

Personal IRL to-do and schedule items share state.listSets.rj.tasks.persistent; irlKind determines their surface. Shared items live in sharedRjState.tasks.todo or .schedule. Editing must preserve the task ID and properties, and save both stores when ownership changes.

CSS remains in cascade order: base/component rules, mode-specific refinements, and responsive overrides. Search for all occurrences of a selector before changing it. Preserve media conditions and selector specificity when consolidating rules. Task composers and recurring panels live outside the task cards; do not reintroduce styles targeting those controls inside .persistent-card.

## Checking changes

Check JavaScript syntax and git diff --check. For browser verification, use a paired account to edit and move an item between Mine/Shared and To-do/Schedule, confirm text and options persist, and reload. Also check MS list selection, Escape/outside-click cancellation, recurring panels, and the mobile layout.

For CSS changes, compare computed styles against the previous stylesheet across IRL/MS, paired/unpaired, editing, recurring panels, settings, and authentication. Include pseudo-elements, hover/focus/disabled states, breakpoint boundaries, reduced motion, and touch input. Freeze animations for static comparisons; keep their declarations and keyframes intact unless separately verified.
