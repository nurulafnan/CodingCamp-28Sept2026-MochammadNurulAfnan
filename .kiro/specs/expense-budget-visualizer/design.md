# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side, single-page web application. Users can record personal expenses by name, amount, and category; see their running total balance; review a scrollable transaction history; and inspect a live pie chart of spending by category. All data is persisted in the browser's Local Storage — no server, no build tool, and no package manager is required.

The entire application ships as three files:
- `index.html` — page structure and CDN script tags
- `css/style.css` — layout, typography, colour, and responsive rules
- `js/app.js` — all application logic (state, validation, rendering, storage)

Chart.js (loaded via CDN) provides the pie chart. No other third-party runtime dependencies exist.

---

## Architecture

The application follows a **uni-directional data flow** pattern implemented in plain JavaScript:

```
User Action
    │
    ▼
[Validator]  ──fail──►  [Error UI]
    │ pass
    ▼
[State Mutation]  ──►  [Storage (localStorage)]
    │
    ▼
[Render Pipeline]
    ├─► renderTransactionList()
    ├─► renderBalanceDisplay()
    └─► renderChart()
```

**State** is held in a single in-memory array (`transactions`) that is always the source of truth. Every mutation (add / delete) writes the new state to Local Storage synchronously *before* triggering the render pipeline. The render pipeline is always a full re-render from the current state — there is no partial/differential DOM update.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Full re-render on every mutation | Keeps logic simple and deterministic; the transaction list is capped at 1,000 entries, so DOM thrashing is bounded and acceptable |
| Storage write before UI update | Guarantees that Local Storage and the displayed state are always in sync; a failed storage write surfaces before the user sees a change |
| Single JS file | Satisfies Requirement 6.1; avoids module bundlers |
| Chart.js via CDN | Satisfies Requirement 4.7; no local installation or build step |

---

## Components and Interfaces

### 1. Input Form (`InputForm`)

**DOM elements**
- `#input-form` — `<form>` element
- `#item-name` — `<input type="text" maxlength="100">`
- `#amount` — `<input type="number" step="0.01" min="0.01" max="999999999.99">`
- `#category` — `<select>` with options Food / Transport / Fun
- `#add-btn` — `<button type="submit">Add Transaction</button>`
- `#form-error` — inline error container (hidden until validation fails)

**Behaviour**
- On `submit` event: call `validateForm()`, then either show errors or call `addTransaction()`.
- On successful submission: call `resetForm()` (clear name/amount, reset category to Food).

---

### 2. Transaction List (`TransactionList`)

**DOM elements**
- `#transaction-list` — `<ul>` container
- Each entry: `<li>` containing item name, formatted amount, category badge, and a delete `<button data-id="...">`.
- `#empty-message` — paragraph shown when list is empty ("No transactions yet.")

**Behaviour**
- `renderTransactionList(transactions)` — clears `#transaction-list` and rebuilds from the array in reverse-chronological order.
- Delete button dispatches a `deleteTransaction(id)` call.

---

### 3. Balance Display (`BalanceDisplay`)

**DOM elements**
- `#balance` — element at the top of the page showing the formatted total.

**Behaviour**
- `renderBalance(transactions)` — sums all valid amounts and sets `#balance` text content. Skips non-numeric amounts (Requirement 3.5).
- Format: currency symbol + absolute value to 2 dp, prefixed with `-` when negative.
- Called synchronously within the render pipeline (within 100 ms requirement met because no async work is involved).

---

### 4. Pie Chart (`ChartView`)

**DOM elements**
- `#chart-canvas` — `<canvas>` element
- `#chart-placeholder` — message shown when no transactions exist

**Behaviour**
- A module-level `chartInstance` variable holds the active `Chart` object (or `null`).
- `renderChart(transactions)`:
  1. If no transactions: destroy any existing chart, show `#chart-placeholder`, return.
  2. Aggregate amounts by category.
  3. Compute each category's percentage share (rounded to 1 dp; redistribute rounding remainder to largest slice to guarantee sum = 100.0%).
  4. If `chartInstance` exists: call `chartInstance.data.datasets[0].data = [...]` then `chartInstance.update()`.
  5. If no instance: `new Chart(canvas, config)` and store in `chartInstance`.

---

### 5. Validator

Pure function — no DOM side-effects; returns a result object.

```js
/**
 * @param {string} name
 * @param {string} rawAmount
 * @param {string} category
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateForm(name, rawAmount, category) { ... }
```

Validation rules (Requirement 1.3–1.5):
- `name`: non-empty after trim, ≤ 100 characters.
- `rawAmount`: parseable as a finite number; value in [0.01, 999,999,999.99]; at most 2 decimal places.
- `category`: one of `["Food", "Transport", "Fun"]`.

---

### 6. Storage Module

All functions are synchronous and wrap `localStorage` calls in try/catch.

```js
function loadTransactions()   // returns Transaction[] | []
function saveTransactions(arr) // throws StorageError on failure
function clearTransactions()   // convenience; used in tests
```

---

### 7. State Module

```js
let transactions = [];          // in-memory source of truth

function addTransaction(t)      // validates cap, writes storage, updates state, renders
function deleteTransaction(id)  // writes storage, updates state, renders
function initApp()              // loads from storage, triggers first render
```

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string}  id        - UUID v4 (crypto.randomUUID())
 * @property {string}  name      - Item name, 1–100 characters
 * @property {number}  amount    - Positive number, max 2 decimal places, in [0.01, 999999999.99]
 * @property {string}  category  - One of: "Food" | "Transport" | "Fun"
 * @property {number}  timestamp - Unix ms timestamp (Date.now()) set at creation
 */
```

### Local Storage Schema

- Key: `"expense_transactions"`
- Value: JSON-serialised `Transaction[]`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "timestamp": 1700000000000
  }
]
```

On load, the app attempts `JSON.parse`. Any parse failure or non-array result is treated as empty (Requirement 5.4). Individual records with non-numeric or missing `amount` fields are skipped during balance calculation (Requirement 3.5) but are still rendered in the list so the user can delete corrupt entries.

### Category Aggregation (for Chart)

```js
/**
 * @typedef {Object} CategoryTotal
 * @property {string} category
 * @property {number} total      - Sum of amounts for this category
 * @property {number} percentage - Share of total, rounded to 1 dp
 */
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Validator rejects whitespace-only names

*For any* string composed entirely of whitespace characters supplied as the item name, the Validator SHALL return `valid: false` and include a non-empty error message identifying the name field.

**Validates: Requirements 1.4**

---

### Property 2: Validator rejects out-of-range and non-numeric amounts

*For any* amount string that is non-numeric, less than 0.01, greater than 999,999,999.99, or has more than two decimal places, the Validator SHALL return `valid: false` and include a non-empty error message identifying the amount field.

**Validates: Requirements 1.5**

---

### Property 3: Transaction add round-trip preserves data

*For any* valid transaction (name, amount, category), after calling `addTransaction`, reading `loadTransactions()` from Local Storage SHALL return an array containing an entry whose `name`, `amount`, and `category` values are strictly equal to the input values.

**Validates: Requirements 5.1**

---

### Property 4: Transaction delete removes from storage

*For any* set of stored transactions, after calling `deleteTransaction(id)` for any transaction `id` in that set, `loadTransactions()` SHALL NOT contain any entry with that `id`.

**Validates: Requirements 2.6, 5.2**

---

### Property 5: Balance sum is consistent with state

*For any* array of transactions (including arrays with corrupt amount entries), `renderBalance` SHALL produce a displayed value equal to the arithmetic sum of only the numeric `amount` fields, and SHALL NOT throw a runtime error.

**Validates: Requirements 3.1, 3.5**

---

### Property 6: Chart percentages sum to 100

*For any* non-empty array of transactions, the percentage values computed for the pie chart SHALL sum to exactly 100.0% (after rounding redistribution).

**Validates: Requirements 4.2**

---

### Property 7: 1,000-transaction cap is enforced

*For any* state where exactly 1,000 transactions are stored, attempting to add one more transaction SHALL return a rejection (and leave storage unchanged) regardless of the content of the new transaction.

**Validates: Requirements 5.5**

---

### Property 8: Local Storage round-trip preserves all fields

*For any* valid `Transaction[]`, serialising to Local Storage and immediately deserialising SHALL produce an array of objects whose `id`, `name`, `amount`, `category`, and `timestamp` fields are strictly equal to the originals.

**Validates: Requirements 5.1, 5.3**

---

### Property 9: Corrupt storage initialises cleanly

*For any* string stored under the transactions key that is not valid JSON or does not parse as an array, `loadTransactions()` SHALL return an empty array and SHALL NOT throw a runtime error.

**Validates: Requirements 5.4**

---

## Error Handling

| Scenario | Detection | Response |
|---|---|---|
| Empty or whitespace item name | `validateForm()` | Inline error on `#form-error`; form not submitted |
| Invalid amount (non-numeric, out-of-range, >2 dp) | `validateForm()` | Inline error on `#form-error`; form not submitted |
| Local Storage write failure (quota exceeded, private browsing) | `try/catch` in `saveTransactions()` | Display a toast/alert error message; abort state mutation and UI update |
| Local Storage read returns unparseable data | `try/catch` + type check in `loadTransactions()` | Return `[]`; app initialises with empty state |
| Individual transaction has corrupt amount | Type check in `renderBalance()` | Skip entry in sum; no thrown error; entry still appears in list for manual deletion |
| 1,000-transaction cap reached | Count check in `addTransaction()` before storage write | Inline message informing user of limit; no storage write |
| Chart.js not loaded (CDN failure) | `typeof Chart === "undefined"` guard in `renderChart()` | Show `#chart-placeholder` with a "Chart unavailable" message; all other features continue working |

---

## Testing Strategy

Because this application consists entirely of pure functions (Validator, Storage module, state calculations) operating on simple data structures, **property-based testing is appropriate** for the core logic layer. UI rendering (DOM manipulation, Chart.js integration, CSS layout) is not amenable to automated property tests and is covered by manual/visual checks.

### Recommended Library

**fast-check** (JavaScript) — loaded via `<script>` tag from CDN (consistent with the no-build-tool constraint), or used in a lightweight test harness if a test runner is introduced later. Each property test runs a minimum of **100 iterations**.

### Unit / Example-Based Tests

These cover specific scenarios that don't benefit from randomisation:

- `validateForm` returns valid for a minimal valid input.
- `validateForm` returns errors for each individual invalid field (name empty, amount = 0, amount = "abc").
- `renderBalance` returns "$0.00" for an empty transaction array.
- `loadTransactions` returns `[]` when `localStorage` is empty.
- Chart is not rendered when transaction array is empty (placeholder shown).
- After the last transaction for a category is deleted, that category's segment is absent from chart data.

### Property-Based Tests

Each test references its design property by tag: **Feature: expense-budget-visualizer, Property N: \<title\>**

| Property | Generator | Assertion |
|---|---|---|
| P1: Validator rejects whitespace names | Arbitrary whitespace strings (spaces, tabs, newlines) | `validateForm(ws, "1.00", "Food").valid === false` |
| P2: Validator rejects invalid amounts | Arbitrary non-numeric strings; numbers outside [0.01, 999999999.99]; numbers with >2 dp | `validateForm("item", bad, "Food").valid === false` |
| P3: Add round-trip preserves data | Arbitrary valid {name, amount, category} tuples | After add, `loadTransactions()` contains matching entry |
| P4: Delete removes from storage | Arbitrary non-empty transaction arrays, pick random id | After delete, `loadTransactions()` has no entry with that id |
| P5: Balance sum consistency | Arbitrary arrays including entries with non-numeric amounts | Displayed sum equals arithmetic sum of numeric amounts only; no error thrown |
| P6: Chart percentages sum to 100 | Arbitrary non-empty transaction arrays | `sum(percentages) === 100.0` |
| P7: 1,000-cap enforcement | Arbitrary transactions appended to a 1,000-entry array | Add attempt rejected; storage unchanged |
| P8: Storage round-trip fidelity | Arbitrary valid `Transaction[]` | Deserialised array deep-equals original |
| P9: Corrupt storage initialises cleanly | Arbitrary non-JSON-array strings | `loadTransactions()` returns `[]`; no error |

### Manual / Visual Testing

- Responsive layout at 320 px, 768 px, 1280 px, and 1920 px viewport widths.
- WCAG colour contrast check (minimum 4.5:1) using browser DevTools or a contrast checker.
- Minimum 16 px font size verified via DevTools computed styles.
- Cross-browser smoke test: Chrome, Firefox, Edge, Safari (latest stable).
- Chart.js renders correctly and updates within 100 ms on add/delete.
- Page load time ≤ 3 s on a simulated 25 Mbps connection (DevTools Network throttle).
