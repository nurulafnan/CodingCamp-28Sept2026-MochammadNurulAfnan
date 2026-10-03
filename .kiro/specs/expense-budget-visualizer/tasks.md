# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a fully client-side single-page web application with three files (`index.html`, `css/style.css`, `js/app.js`). The implementation follows a uni-directional data flow: User Action → Validator → State Mutation → Storage → Render Pipeline. Chart.js is loaded via CDN. No build tools or backend are required.

## Tasks

- [x] 1. Scaffold project file structure
  - Create `index.html` at the project root with the required HTML skeleton: `<head>` with CDN links for Chart.js and the local CSS file, and a `<body>` containing placeholder sections for the balance display, input form, transaction list, and chart canvas
  - Create `css/style.css` inside a `css/` directory (file may be empty at this stage)
  - Create `js/app.js` inside a `js/` directory (file may be empty at this stage)
  - Wire the HTML file's `<script src="js/app.js">` tag so the browser loads the JS on open
  - _Requirements: 6.1, 6.2_

- [x] 2. Implement the Data Model and Storage Module
  - [x] 2.1 Define the `Transaction` typedef and Storage module in `js/app.js`
    - Document the `Transaction` shape: `{ id, name, amount, category, timestamp }`
    - Implement `loadTransactions()` — reads `"expense_transactions"` from `localStorage`, parses JSON, returns `Transaction[]` or `[]` on any failure (parse error, non-array result)
    - Implement `saveTransactions(arr)` — serialises and writes to `localStorage`; throws a `StorageError` on `localStorage` failure (quota exceeded, private mode)
    - Wrap all `localStorage` calls in `try/catch`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.2 Write property test for Storage round-trip fidelity (Property 8)
    - **Property 8: Local Storage round-trip preserves all fields**
    - For any valid `Transaction[]`, serialise to Local Storage then deserialise; assert `id`, `name`, `amount`, `category`, and `timestamp` are strictly equal to the originals
    - Use fast-check loaded via CDN in a standalone test HTML file
    - **Validates: Requirements 5.1, 5.3**

  - [ ]* 2.3 Write property test for corrupt storage initialisation (Property 9)
    - **Property 9: Corrupt storage initialises cleanly**
    - For any arbitrary non-JSON-array string stored under the transactions key, assert `loadTransactions()` returns `[]` and does not throw
    - **Validates: Requirements 5.4**

- [x] 3. Implement the Validator
  - [x] 3.1 Implement the `validateForm(name, rawAmount, category)` pure function in `js/app.js`
    - Returns `{ valid: boolean, errors: string[] }`
    - Name rule: non-empty after `.trim()`, ≤ 100 characters
    - Amount rule: parseable as a finite number; value in `[0.01, 999999999.99]`; at most 2 decimal places (use string-split or regex check)
    - Category rule: one of `["Food", "Transport", "Fun"]`
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ]* 3.2 Write property test for validator whitespace-only names (Property 1)
    - **Property 1: Validator rejects whitespace-only names**
    - Generate arbitrary strings composed entirely of spaces, tabs, and newlines; assert `validateForm(ws, "1.00", "Food").valid === false` and `errors` is non-empty
    - **Validates: Requirements 1.4**

  - [ ]* 3.3 Write property test for validator invalid amounts (Property 2)
    - **Property 2: Validator rejects out-of-range and non-numeric amounts**
    - Generate arbitrary non-numeric strings, numbers outside `[0.01, 999999999.99]`, and numbers with >2 decimal places; assert `validateForm("item", bad, "Food").valid === false`
    - **Validates: Requirements 1.5**

- [x] 4. Implement the State Module
  - [x] 4.1 Implement the in-memory state array and `addTransaction` in `js/app.js`
    - Declare `let transactions = []`
    - Implement `addTransaction({ name, amount, category })`:
      1. Check that `transactions.length < 1000`; if at the cap, display an inline cap-reached message and return early (no storage write)
      2. Build a `Transaction` object: `id = crypto.randomUUID()`, `timestamp = Date.now()`
      3. Call `saveTransactions([...transactions, newTx])`; on `StorageError`, surface the error to the user and return without mutating state
      4. Push the new transaction onto `transactions`
      5. Call the render pipeline (`renderTransactionList`, `renderBalanceDisplay`, `renderChart`)
    - _Requirements: 5.1, 5.5, 2.4, 3.2_

  - [ ]* 4.2 Write property test for the 1,000-transaction cap (Property 7)
    - **Property 7: 1,000-transaction cap is enforced**
    - Seed `transactions` with exactly 1,000 entries; attempt `addTransaction` with arbitrary valid input; assert it is rejected and `loadTransactions()` still contains exactly 1,000 entries
    - **Validates: Requirements 5.5**

  - [x] 4.3 Implement `deleteTransaction(id)` and `initApp` in `js/app.js`
    - `deleteTransaction(id)`:
      1. Filter `transactions` to produce `updated = transactions.filter(t => t.id !== id)`
      2. Call `saveTransactions(updated)`; on `StorageError`, display an error message and return without mutating state (Requirement 2.7)
      3. Set `transactions = updated`
      4. Call the render pipeline
    - `initApp()`:
      1. Set `transactions = loadTransactions()`
      2. Call the render pipeline
    - _Requirements: 2.6, 2.7, 5.2, 5.3, 5.4_

  - [ ]* 4.4 Write property test for transaction add round-trip (Property 3)
    - **Property 3: Transaction add round-trip preserves data**
    - For arbitrary valid `{ name, amount, category }` tuples, call `addTransaction`, then assert `loadTransactions()` contains an entry with strictly equal `name`, `amount`, and `category`
    - **Validates: Requirements 5.1**

  - [ ]* 4.5 Write property test for transaction delete removes from storage (Property 4)
    - **Property 4: Transaction delete removes from storage**
    - For arbitrary non-empty transaction arrays with a random `id` selected, call `deleteTransaction(id)`, then assert `loadTransactions()` contains no entry with that `id`
    - **Validates: Requirements 2.6, 5.2**

- [x] 5. Checkpoint — core logic complete
  - Verify that `validateForm`, `addTransaction`, `deleteTransaction`, `loadTransactions`, and `saveTransactions` all behave correctly in isolation. Ask the user if any questions arise before proceeding to the UI layer.

- [x] 6. Implement the Balance Display renderer
  - [x] 6.1 Implement `renderBalanceDisplay(transactions)` in `js/app.js`
    - Add `<div id="balance">` to `index.html` above all transaction list elements
    - In `renderBalanceDisplay`: sum only entries where `typeof t.amount === "number" && isFinite(t.amount)`; skip others without throwing
    - Format output: prepend currency symbol (`$`), fix to 2 decimal places, prepend `-` when negative (Requirement 3.1)
    - Show `$0.00` when array is empty (Requirement 3.4)
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

  - [ ]* 6.2 Write property test for balance sum consistency (Property 5)
    - **Property 5: Balance sum is consistent with state**
    - Generate arbitrary arrays including entries with non-numeric amount values; assert the displayed value equals the arithmetic sum of only the numeric entries, and no error is thrown
    - **Validates: Requirements 3.1, 3.5**

- [x] 7. Implement the Transaction List renderer
  - [x] 7.1 Implement `renderTransactionList(transactions)` in `js/app.js`
    - Add `<ul id="transaction-list">` and `<p id="empty-message">No transactions yet.</p>` to `index.html`
    - Clear `#transaction-list` on each call; if `transactions` is empty, show `#empty-message` and return
    - Render entries in reverse-chronological order (sort descending by `timestamp`)
    - Each `<li>` contains: item name, amount formatted with currency symbol to 2 dp, category badge, and a `<button data-id="...">Delete</button>`
    - Attach a click listener (or use event delegation on the `<ul>`) that calls `deleteTransaction(id)` from the `data-id` attribute
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

- [x] 8. Implement the Input Form and wire validation
  - [x] 8.1 Build the Input Form HTML and hook up the submit handler in `js/app.js`
    - Add to `index.html`: `<form id="input-form">` containing `<input id="item-name" type="text" maxlength="100">`, `<input id="amount" type="number" step="0.01" min="0.01" max="999999999.99">`, `<select id="category">` with options Food/Transport/Fun, `<button type="submit">Add Transaction</button>`, and `<div id="form-error" hidden>`
    - On `submit` event: call `validateForm(name, rawAmount, category)`
      - If invalid: populate `#form-error` with the error messages and set `hidden = false`; do not create a transaction
      - If valid: hide `#form-error`, call `addTransaction(...)`, then `resetForm()`
    - Implement `resetForm()`: clear `#item-name` and `#amount`; reset `#category` to its first option (Food)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 9. Implement the Category Pie Chart renderer
  - [x] 9.1 Add the chart canvas to `index.html` and implement `renderChart(transactions)` in `js/app.js`
    - Add `<canvas id="chart-canvas">` and `<p id="chart-placeholder">` to `index.html`
    - Declare a module-level `let chartInstance = null`
    - Guard against CDN failure: if `typeof Chart === "undefined"`, show `#chart-placeholder` with "Chart unavailable" and return
    - If `transactions` is empty: destroy any existing `chartInstance` (call `.destroy()` if non-null, then set to `null`), show `#chart-placeholder` with "No data available", hide `#chart-canvas`, return
    - Aggregate amounts by category; compute per-category percentage rounded to 1 dp; redistribute rounding remainder to the largest slice so percentages sum exactly to 100.0%
    - If `chartInstance` exists: update `chartInstance.data` and call `chartInstance.update()`
    - If no instance: call `new Chart(canvas, config)` and store in `chartInstance`
    - Label each segment with category name and its percentage
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 9.2 Write property test for chart percentages summing to 100 (Property 6)
    - **Property 6: Chart percentages sum to 100**
    - For arbitrary non-empty transaction arrays, extract the percentage-computation logic (pure function) and assert `sum(percentages) === 100.0`
    - **Validates: Requirements 4.2**

- [x] 10. Checkpoint — all renderers wired
  - Ensure `initApp()` is called on `DOMContentLoaded`, and that every mutation (`addTransaction`, `deleteTransaction`) calls all three render functions. Ask the user if any questions arise before proceeding to styling.

- [x] 11. Apply CSS layout and responsive styles
  - [-] 11.1 Write `css/style.css` with layout, typography, colour, and responsive rules
    - Use a single-column layout centred on the page; stack balance → form → list → chart vertically
    - Set a minimum font size of 16 px for all text content
    - Choose foreground/background colour pairs that meet WCAG 4.5:1 contrast ratio (e.g. dark text on light background)
    - Add `overflow-y: auto` (or `scroll`) to `#transaction-list` with a fixed `max-height` so it scrolls when it overflows
    - Use CSS media queries or fluid units (`%`, `vw`, `rem`) so the layout renders correctly at viewport widths from 320 px to 1920 px without overflow or hidden content
    - _Requirements: 2.3, 7.3, 7.4_

- [~] 12. Implement error display for storage failures and cap message
  - [~] 12.1 Add error toast/alert UI and cap-reached inline message to `index.html` and `js/app.js`
    - Add a `<div id="storage-error" hidden>` element for storage failure messages
    - In `addTransaction` and `deleteTransaction`, when `saveTransactions` throws: populate and show `#storage-error`; do not mutate state or update the UI
    - Add a `<p id="cap-message" hidden>` element near the form for the 1,000-transaction cap message
    - In `addTransaction`, when `transactions.length >= 1000`: populate and show `#cap-message`; do not write to storage
    - _Requirements: 2.7, 5.5_

- [~] 13. Final checkpoint — full integration
  - Open `index.html` directly in a browser (no server required) and verify:
    - Adding a transaction updates the list, balance, and chart immediately
    - Deleting a transaction updates all three UI areas
    - Refreshing the page restores all transactions from Local Storage
    - Validation errors appear inline without submitting
    - The layout is usable at narrow (320 px) and wide (1920 px) viewports
  - Ensure all non-optional automated tests pass. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests reference the design document's Correctness Properties section by number
- fast-check for property tests can be loaded via CDN (no build tool needed): `https://cdn.jsdelivr.net/npm/fast-check/lib/bundle/fast-check.min.js`
- Each task references specific requirements for traceability
- Checkpoints (tasks 5, 10, 13) are the right moments to ask the user before moving on
- The render pipeline is always a full re-render — no partial DOM diffing needed
- Storage writes happen *before* state/UI updates to keep Local Storage and displayed state in sync

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.2", "3.3", "4.1"] },
    { "id": 2, "tasks": ["4.2", "4.3", "4.4", "4.5"] },
    { "id": 3, "tasks": ["6.1", "7.1", "8.1", "9.1"] },
    { "id": 4, "tasks": ["6.2", "9.2", "11.1", "12.1"] }
  ]
}
```
