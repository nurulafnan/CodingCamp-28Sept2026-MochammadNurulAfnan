// Expense & Budget Visualizer — application logic (populated in Tasks 2–12)

// ---------------------------------------------------------------------------
// Data Model
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Transaction
 * @property {string}  id        - UUID v4 (crypto.randomUUID())
 * @property {string}  name      - Item name, 1–100 characters
 * @property {number}  amount    - Positive number, max 2 decimal places, in [0.01, 999999999.99]
 * @property {string}  category  - One of: "Food" | "Transport" | "Fun"
 * @property {number}  timestamp - Unix ms timestamp (Date.now()) set at creation
 */

// ---------------------------------------------------------------------------
// StorageError — thrown when a localStorage write operation fails
// ---------------------------------------------------------------------------

class StorageError extends Error {
  /**
   * @param {string} message - Human-readable description of the failure
   * @param {unknown} [cause]  - Original error from the platform (optional)
   */
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

// ---------------------------------------------------------------------------
// Storage Module
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'expense_transactions';

/**
 * Reads all persisted transactions from localStorage.
 *
 * Returns a `Transaction[]` on success.
 * Returns `[]` on any failure: empty storage, parse error, non-array result.
 * Never throws.
 *
 * @returns {Transaction[]}
 */
function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (_err) {
    // Covers JSON.parse failures and any unexpected localStorage read errors
    return [];
  }
}

/**
 * Serialises `arr` and writes it to localStorage.
 *
 * Throws a `StorageError` if the write fails (e.g. quota exceeded,
 * private-browsing restrictions, or any other platform error).
 *
 * @param {Transaction[]} arr
 * @throws {StorageError}
 */
function saveTransactions(arr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (err) {
    throw new StorageError(
      'Unable to save transactions. Storage may be full or unavailable.',
      err
    );
  }
}

/**
 * Removes the transactions key from localStorage entirely.
 * Convenience helper used in tests; silently ignores errors.
 */
function clearTransactions() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_err) {
    // Nothing to do — if removal fails the key simply stays
  }
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];
const AMOUNT_MIN = 0.01;
const AMOUNT_MAX = 999999999.99;
const NAME_MAX_LENGTH = 100;

/**
 * Validates the three Input Form fields before a Transaction is created.
 *
 * Pure function — no DOM side-effects.
 *
 * @param {string} name       - Raw value from the Item Name field
 * @param {string} rawAmount  - Raw value from the Amount field (as a string)
 * @param {string} category   - Selected value from the Category field
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateForm(name, rawAmount, category) {
  const errors = [];

  // --- Name validation (Requirements 1.4) ---
  const trimmedName = (typeof name === 'string' ? name : '').trim();
  if (trimmedName.length === 0) {
    errors.push('Item name is required.');
  } else if (trimmedName.length > NAME_MAX_LENGTH) {
    errors.push('Item name must be 100 characters or fewer.');
  }

  // --- Amount validation (Requirements 1.5) ---
  const amountStr = (typeof rawAmount === 'string' ? rawAmount : String(rawAmount ?? '')).trim();
  const parsed = parseFloat(amountStr);

  if (amountStr === '' || !isFinite(parsed) || isNaN(parsed)) {
    errors.push('Amount must be a valid number.');
  } else if (parsed < AMOUNT_MIN || parsed > AMOUNT_MAX) {
    errors.push('Amount must be between 0.01 and 999,999,999.99.');
  } else {
    // Check for more than 2 decimal places using string inspection
    const dotIndex = amountStr.indexOf('.');
    if (dotIndex !== -1 && amountStr.length - dotIndex - 1 > 2) {
      errors.push('Amount must have at most 2 decimal places.');
    }
  }

  // --- Category validation (Requirements 1.3) ---
  if (!VALID_CATEGORIES.includes(category)) {
    errors.push('Category must be one of: Food, Transport, Fun.');
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// State Module
// ---------------------------------------------------------------------------

/** @type {Transaction[]} In-memory source of truth; always mirrors localStorage */
let transactions = [];

const TRANSACTION_CAP = 1000;

/**
 * Shows a message inside a DOM element identified by `id`.
 * Guards gracefully when the element does not exist yet.
 *
 * @param {string} id      - Element id (without #)
 * @param {string} message - Text to display
 */
function showMessage(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

/**
 * Hides a DOM element identified by `id`.
 * Guards gracefully when the element does not exist yet.
 *
 * @param {string} id - Element id (without #)
 */
function hideMessage(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = true;
}

/**
 * Adds a new transaction to in-memory state and localStorage, then re-renders.
 *
 * Flow (per design):
 *  1. Enforce the 1,000-transaction cap (Requirement 5.5)
 *  2. Build a Transaction object
 *  3. Persist to localStorage BEFORE mutating state (Requirement 5.1)
 *  4. Mutate in-memory state
 *  5. Trigger the render pipeline (Requirements 2.4, 3.2)
 *
 * @param {{ name: string, amount: number, category: string }} param0
 */
function addTransaction({ name, amount, category }) {
  // --- 1. Cap check (Requirement 5.5) ---
  if (transactions.length >= TRANSACTION_CAP) {
    showMessage(
      'cap-message',
      'Transaction limit reached (1,000 max). Please delete some entries before adding new ones.'
    );
    return;
  }

  // Clear any previously shown cap message on a successful attempt
  hideMessage('cap-message');

  // --- 2. Build the Transaction object ---
  /** @type {Transaction} */
  const newTx = {
    id: crypto.randomUUID(),
    name,
    amount,
    category,
    timestamp: Date.now(),
  };

  // --- 3. Persist BEFORE mutating state (Requirement 5.1) ---
  try {
    saveTransactions([...transactions, newTx]);
  } catch (err) {
    // Surface the StorageError to the user; do not mutate state (design: Error Handling)
    showMessage(
      'storage-error',
      err instanceof StorageError
        ? err.message
        : 'Unable to save transaction. Please try again.'
    );
    return;
  }

  // Clear any previously shown storage error on success
  hideMessage('storage-error');

  // --- 4. Mutate in-memory state ---
  transactions.push(newTx);

  // --- 5. Render pipeline ---
  renderTransactionList(transactions);
  renderBalanceDisplay(transactions);
  if (typeof renderChart === 'function') renderChart(transactions);
}

/**
 * Removes the transaction with the given `id` from in-memory state and localStorage,
 * then re-renders.
 *
 * Flow (per design):
 *  1. Compute the updated array without the target transaction
 *  2. Persist to localStorage BEFORE mutating state (Requirement 5.2)
 *  3. On StorageError: surface the error, do NOT mutate state (Requirement 2.7)
 *  4. Mutate in-memory state
 *  5. Trigger the render pipeline (Requirements 2.6, 3.3, 4.4)
 *
 * @param {string} id - UUID of the transaction to remove
 */
function deleteTransaction(id) {
  // --- 1. Compute updated array without the target transaction ---
  const updated = transactions.filter(t => t.id !== id);

  // --- 2. Persist BEFORE mutating state (Requirement 5.2) ---
  try {
    saveTransactions(updated);
  } catch (err) {
    // --- 3. Surface the StorageError; do NOT mutate state (Requirement 2.7) ---
    showMessage(
      'storage-error',
      err instanceof StorageError
        ? err.message
        : 'Unable to delete transaction. Please try again.'
    );
    return;
  }

  // Clear any previously shown storage error on success
  hideMessage('storage-error');

  // --- 4. Mutate in-memory state ---
  transactions = updated;

  // --- 5. Render pipeline ---
  renderTransactionList(transactions);
  renderBalanceDisplay(transactions);
  if (typeof renderChart === 'function') renderChart(transactions);
}

// ---------------------------------------------------------------------------
// Transaction List Renderer
// ---------------------------------------------------------------------------

/**
 * Renders all transactions into `#transaction-list` in reverse-chronological order
 * (most recent first, sorted descending by `timestamp`).
 *
 * Behaviour:
 *  - Clears the list on every call (full re-render, no partial diffing)
 *  - Shows `#empty-message` and hides the list when the array is empty (Requirement 2.8)
 *  - Each `<li>` contains: item name, formatted amount, category badge, delete button
 *  - Uses event delegation on the `<ul>` — one click listener handles all delete buttons
 *    by reading `data-id` from the clicked button (Requirement 2.6)
 *
 * Amount format: `$` prefix + value to 2 decimal places (e.g. `$12.50`) (Requirement 2.2)
 *
 * @param {Transaction[]} transactions - Current in-memory state
 */
function renderTransactionList(transactions) {
  const list = document.getElementById('transaction-list');
  const emptyMsg = document.getElementById('empty-message');

  if (!list) return;

  // Clear existing entries
  list.innerHTML = '';

  // Empty state (Requirement 2.8)
  if (transactions.length === 0) {
    if (emptyMsg) emptyMsg.hidden = false;
    return;
  }

  // Hide the empty-state message when there are entries
  if (emptyMsg) emptyMsg.hidden = true;

  // Sort descending by timestamp — most recent first (Requirement 2.1)
  const sorted = transactions.slice().sort((a, b) => b.timestamp - a.timestamp);

  // Build DOM fragment for performance
  const fragment = document.createDocumentFragment();

  sorted.forEach(tx => {
    const li = document.createElement('li');
    li.className = 'transaction-item';

    // Item name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'transaction-name';
    nameSpan.textContent = tx.name;

    // Amount — format to 2 dp with $ prefix (Requirement 2.2)
    const amountSpan = document.createElement('span');
    amountSpan.className = 'transaction-amount';
    const amountValue = (typeof tx.amount === 'number' && isFinite(tx.amount))
      ? tx.amount
      : 0;
    amountSpan.textContent = `$${amountValue.toFixed(2)}`;

    // Category badge (Requirement 2.2)
    const categorySpan = document.createElement('span');
    categorySpan.className = 'category-badge';
    categorySpan.textContent = tx.category;

    // Delete button — carries the transaction id as a data attribute (Requirement 2.5, 2.6)
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.id = tx.id;
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete transaction: ${tx.name}`);

    li.append(nameSpan, amountSpan, categorySpan, deleteBtn);
    fragment.appendChild(li);
  });

  list.appendChild(fragment);
}

// Event delegation on #transaction-list — handles delete button clicks (Requirement 2.6)
// Attached once after DOM is ready; deleteTransaction is defined earlier in this file.
document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('transaction-list');
  if (list) {
    list.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-id]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (id) deleteTransaction(id);
    });
  }
});

// ---------------------------------------------------------------------------
// Input Form — submit handler and reset helper
// ---------------------------------------------------------------------------

/**
 * Resets the Input Form to its default state after a successful submission.
 *
 * - Clears the Item Name field
 * - Clears the Amount field
 * - Resets the Category select to its first option (Food)
 *
 * (Requirement 1.6)
 */
function resetForm() {
  const nameInput = document.getElementById('item-name');
  const amountInput = document.getElementById('amount');
  const categorySelect = document.getElementById('category');

  if (nameInput) nameInput.value = '';
  if (amountInput) amountInput.value = '';
  if (categorySelect) categorySelect.selectedIndex = 0;
}

// Attach the form submit handler once the DOM is ready (Requirements 1.1–1.6)
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('input-form');
  const formError = document.getElementById('form-error');

  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    // Read current field values
    const nameInput = document.getElementById('item-name');
    const amountInput = document.getElementById('amount');
    const categorySelect = document.getElementById('category');

    const name = nameInput ? nameInput.value : '';
    const rawAmount = amountInput ? amountInput.value : '';
    const category = categorySelect ? categorySelect.value : '';

    // Run validation (Requirements 1.3–1.5)
    const { valid, errors } = validateForm(name, rawAmount, category);

    if (!valid) {
      // Show inline errors (Requirement 1.4, 1.5)
      if (formError) {
        formError.innerHTML = '';
        errors.forEach(msg => {
          const p = document.createElement('p');
          p.textContent = msg;
          formError.appendChild(p);
        });
        formError.hidden = false;
      }
      return;
    }

    // Valid submission — hide any previous error, add the transaction, reset
    if (formError) formError.hidden = true;

    addTransaction({
      name: name.trim(),
      amount: parseFloat(rawAmount),
      category,
    });

    resetForm(); // Requirement 1.6
  });
});

// ---------------------------------------------------------------------------
// Balance Display Renderer
// ---------------------------------------------------------------------------

/**
 * Renders the total balance of all transactions into `#balance`.
 *
 * Only entries where `typeof t.amount === "number" && isFinite(t.amount)`
 * are included in the sum; all other entries are silently skipped so that
 * corrupt storage records never cause a runtime error (Requirement 3.5).
 *
 * Format rules (Requirement 3.1):
 *  - Positive / zero: `$X.XX`  (e.g. "$12.50", "$0.00")
 *  - Negative:        `-$X.XX` (e.g. "-$5.00")
 *
 * Shows `$0.00` when `transactions` is empty (Requirement 3.4).
 *
 * @param {Transaction[]} transactions
 */
function renderBalanceDisplay(transactions) {
  const total = transactions.reduce((sum, t) => {
    if (typeof t.amount === 'number' && isFinite(t.amount)) {
      return sum + t.amount;
    }
    return sum;
  }, 0);

  const absValue = Math.abs(total).toFixed(2);
  const formatted = total < 0 ? `-$${absValue}` : `$${absValue}`;

  const el = document.getElementById('balance');
  if (el) {
    el.textContent = formatted;
  }
}

// ---------------------------------------------------------------------------
// App Initialisation
// ---------------------------------------------------------------------------

/**
 * Bootstraps the application on page load.
 *
 * Flow:
 *  1. Load all persisted transactions from localStorage into in-memory state
 *  2. Trigger the render pipeline to populate the UI
 *
 * Handles all failure modes in `loadTransactions` (empty storage, parse error)
 * by falling back to an empty array — no runtime error is thrown (Requirements 5.3, 5.4).
 */
function initApp() {
  // --- 1. Hydrate in-memory state from localStorage ---
  transactions = loadTransactions();

  // --- 2. Render pipeline ---
  renderTransactionList(transactions);
  renderBalanceDisplay(transactions);
  if (typeof renderChart === 'function') renderChart(transactions);
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', initApp);
