# R&J planner

A plain HTML, CSS, and JavaScript planner with Supabase authentication and syncing. No frontend build step is needed. Serve this directory with a static HTTP server and open index.html.

## Code map

| File | Responsibility | Fast Navigation Tags |
| --- | --- | --- |
| index.html | Semantic structure, templates, and script loading | — |
| styles.css | Shared styles, themes, and responsive layouts | `[SEC-01]` through `[SEC-12]` |
| app.js | Bootstrap, shared state, DOM cache, task actions, and reset scheduler | `[APP-01]` through `[APP-14]` |
| task-edit.js | Edit form lifecycle, outside-click handling, and saving/moving tasks | Function-level |
| task-lists.js | Personal/shared/partner list rendering and IRL drag surfaces | Function-level |
| planner-time.js | Date normalization, recurrence calculations, and reset labels | Function-level |
| sync.js | Authentication, pairing, local storage, and Supabase syncing | Function-level |
| assets/ | Static PNG icons and symbols (`owner-mine.png`, `owner-shared.png`) | — |
| supabase-setup.sql | Database schema and access policies | — |
| tests/ | Isolated browser test harness and regression test suites | `retention`, `sync`, `resets` |

### Fast Navigation Index

Use quick keyword search (`[APP-XX]` or `[SEC-XX]`) to jump straight to any section:

- **styles.css**:
  - `[SEC-01]` Design Tokens & Themes (Light/Dark Mode, Pastel Accents)
  - `[SEC-02]` Base Resets, Typography & Form Inputs
  - `[SEC-03]` Application Header, Auth & Session Controls
  - `[SEC-04]` Task Cards, List Items & Drag Surfaces
  - `[SEC-05]` Component Palettes, Dialogs & Settings Modal
  - `[SEC-06]` IRL Mode Dual-Column Layout & Composer
  - `[SEC-07]` Recurring Panel, Schedule Panel & Day Pickers
  - `[SEC-08]` Dropdowns, Custom Selects & Animations
  - `[SEC-09]` Refined Layout Overrides, Popups & Scrolling
  - `[SEC-10]` Compact Controls, IRL Target Grid & Owner Toggle
  - `[SEC-11]` Shared Surfaces & Recurring Overviews
  - `[SEC-12]` Responsive Breakpoints (Mobile & Tablet)

- **app.js**:
  - `[APP-01]` Configuration, Storage Keys & Constants
  - `[APP-02]` State Factories & Default State
  - `[APP-03]` DOM Element Cache (`els`)
  - `[APP-04]` Theme Management (Light / Dark Mode)
  - `[APP-05]` Bootstrap Initialization (`initialize()`)
  - `[APP-06]` Midnight Resets & Reset Scheduler
  - `[APP-07]` Event Wiring & Listeners
  - `[APP-08]` Custom Dropdown Select Controls
  - `[APP-09]` List Sets & Tab Navigation (IRL vs MS)
  - `[APP-10]` Recurring Options & Day Pickers
  - `[APP-11]` Task Completion & Completion Orders
  - `[APP-12]` Settings UI & Pairing Hydration
  - `[APP-13]` Timed Expirations & Midnight Reset Timers
  - `[APP-14]` Local Storage Data Normalization & Hydration

## Loading and data contracts

These are classic scripts sharing the same global scope. Helper files contain function declarations only and must load before app.js, which initializes shared state and starts the app. Keep script tags in index.html in order; do not add async.

Personal IRL to-do and schedule items share state.listSets.rj.tasks.persistent; irlKind determines their surface. Shared items live in sharedRjState.tasks.todo or .schedule. Editing must preserve the task ID and properties, and save both stores when ownership changes.

CSS remains in cascade order: base/component rules, mode-specific refinements, and responsive overrides. Search for all occurrences of a selector before changing it. Preserve media conditions and selector specificity when consolidating rules. Task composers and recurring panels live outside the task cards; do not reintroduce styles targeting those controls inside .persistent-card.

## Checking changes

Check JavaScript syntax and git diff --check. For browser verification, use a paired account to edit and move an item between Mine/Shared and To-do/Schedule, confirm text and options persist, and reload. Also check MS list selection, Escape/outside-click cancellation, recurring panels, and the mobile layout.

For CSS changes, compare computed styles against the previous stylesheet across IRL/MS, paired/unpaired, editing, recurring panels, settings, and authentication. Include pseudo-elements, hover/focus/disabled states, breakpoint boundaries, reduced motion, and touch input. Freeze animations for static comparisons; keep their declarations and keyframes intact unless separately verified.

## Task retention regression checks

IRL daily cleanup runs at midnight in the selected time zone, including the optional daylight saving adjustment: unfinished tasks carry forward, completed one-time tasks clear at the daily reset, and recurring definitions remain. MS daily tasks reset at midnight UTC every day, and MS weekly tasks reset on Thursday at midnight UTC every week; completed MS daily and weekly tasks stay crossed out until their respective reset, when their completion status resets to uncompleted without deleting the tasks. A timer targets the next midnight boundary, and checks when the page resumes catch resets after sleep or reopening. Completion dates are checked even when the saved reset marker is already current, so late cloud responses cannot bypass cleanup.

Sync reconciles local and cloud task collections rather than discarding one snapshot. Manual deletions and expired one-time completions are stored in `deletedTaskIds`, so merging older snapshots cannot restore cleared tasks. Failed saves keep their local copy and retry during the periodic update. Older clients do not record deletions; reload updated clients before deleting tasks on another device.

Run `python tests/run-task-retention.py` (Chrome required; use `--chrome PATH` to select a binary). The isolated browser harness uses fake dates and mocked sync responses; it never signs in or contacts Supabase. It covers 40 days of resets and reloads, the PST midnight boundary, daylight saving adjustment, completion dates, backward clock changes, hidden scheduled items during reordering, and late shared-list responses.

The sync suite also exercises actual local storage, delayed login responses, newer incomplete cloud snapshots, failed reads/writes, queued edits, manual deletion, and 90 days across every time-zone/DST combination. The reset suite simulates exact midnight timer callbacks, completed and recurring tasks, storage reloads, and stale cloud snapshots over 30 days for every time-zone/DST combination in both IRL and MS. Use `--suite retention`, `--suite sync`, or `--suite resets` to run one suite.
