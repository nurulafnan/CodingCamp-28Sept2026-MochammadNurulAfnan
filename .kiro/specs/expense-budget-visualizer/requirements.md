# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses by category, view a running total balance, and visualize spending distribution through a pie chart. The app is built with HTML, CSS, and Vanilla JavaScript, uses the browser's Local Storage API for persistence, and requires no backend server or complex setup.

## Glossary

- **App**: The Expense & Budget Visualizer single-page web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Category**: One of three predefined expense classifications: Food, Transport, or Fun.
- **Transaction_List**: The scrollable on-screen list that displays all recorded Transactions.
- **Input_Form**: The HTML form through which the user enters a new Transaction.
- **Balance_Display**: The UI element at the top of the page that shows the sum of all Transaction amounts.
- **Chart**: The pie chart that visualises spending distribution across Categories.
- **Storage**: The browser Local Storage API used to persist Transactions between sessions.
- **Validator**: The client-side logic that checks Input_Form fields before a Transaction is saved.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to enter an expense with a name, amount, and category so that I can record my spending.

#### Acceptance Criteria

1. THE Input_Form SHALL display three fields: Item Name (text, maximum 100 characters), Amount (numeric), and Category (select with options Food, Transport, Fun).
2. THE Input_Form SHALL display a submit button labelled "Add Transaction".
3. WHEN the user submits the Input_Form with all fields filled and an Amount value between 0.01 and 999,999,999.99 inclusive with at most two decimal places, THE Validator SHALL accept the submission and create a new Transaction.
4. IF the user submits the Input_Form with one or more empty fields, THEN THE Validator SHALL display an inline error message identifying the missing fields and SHALL NOT create a Transaction.
5. IF the user enters a value in the Amount field that is non-numeric, less than 0.01, greater than 999,999,999.99, or has more than two decimal places, THEN THE Validator SHALL display an inline error message indicating the invalid Amount and SHALL NOT create a Transaction.
6. WHEN a Transaction is successfully created, THE Input_Form SHALL reset the Item Name and Amount fields to empty and reset the Category field to its first option (Food).

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded expenses in a scrollable list so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored Transactions in reverse-chronological order (most recent first).
2. THE Transaction_List SHALL display the item name, amount (prefixed with a currency symbol and formatted to exactly 2 decimal places), and category for each Transaction.
3. IF the number of Transactions exceeds the visible area of the Transaction_List container, THEN THE Transaction_List SHALL be scrollable so that all entries are reachable without a page reload.
4. WHEN a new Transaction is created, THE Transaction_List SHALL update to include the new entry within 1 second and without a page reload.
5. THE Transaction_List SHALL display a delete button for each Transaction entry.
6. WHEN the user clicks the delete button for a Transaction, THE App SHALL remove that Transaction from the Transaction_List and from Storage.
7. IF a Storage delete operation fails, THEN THE App SHALL display an error message to the user and SHALL retain the Transaction in both the Transaction_List and Storage.
8. WHILE the Transaction_List contains no entries, THE App SHALL display the message "No transactions yet."

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending at the top of the page so that I always know how much I have spent overall.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of the Amount values of all Transactions, prefixed with a currency symbol, formatted to exactly 2 decimal places, and prefixed with a minus sign when the total is negative.
2. WHEN a Transaction is created, THE Balance_Display SHALL update its displayed value within 100 ms of the creation event.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update its displayed value within 100 ms of the deletion event.
4. WHILE the Transaction_List contains no entries, THE Balance_Display SHALL show a value of zero formatted as a currency amount (e.g., $0.00).
5. IF any persisted Transaction contains a non-numeric or missing Amount value, THEN THE App SHALL exclude that Transaction from the Balance_Display sum and SHALL NOT throw a runtime error.
6. THE Balance_Display SHALL be positioned above all Transaction_List entries in the document flow so that it is visible without scrolling when the page first loads.

---

### Requirement 4: Category Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going at a glance.

#### Acceptance Criteria

1. THE Chart SHALL render as a pie chart displaying one segment per Category that has at least one Transaction, where each segment's arc size is proportional to that Category's share of total spending.
2. THE Chart SHALL label each segment with the Category name and the percentage of total spending it represents, rounded to one decimal place, such that the sum of all displayed percentages equals 100.0%.
3. WHEN a Transaction is created, THE Chart SHALL re-render to reflect the updated spending distribution within 100 ms of the creation event.
4. WHEN a Transaction is deleted, THE Chart SHALL re-render to reflect the updated spending distribution within 100 ms of the deletion event.
5. WHILE the Transaction_List contains no entries, THE Chart SHALL display a placeholder state with no pie segments rendered and a message indicating that no data is available.
6. IF the last Transaction for a given Category is deleted, THEN THE Chart SHALL remove that Category's segment entirely so that no zero-value segment is displayed.
7. THE Chart SHALL use a charting library (such as Chart.js) loaded via CDN, requiring no build step or local installation.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions so that I do not lose my data when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is created, THE Storage SHALL persist the full Transaction data (item name up to 100 characters, amount between 0.01 and 999,999,999.99, and category) to Local Storage before the UI updates.
2. WHEN a Transaction is deleted, THE Storage SHALL remove the corresponding Transaction data from Local Storage before the UI updates.
3. WHEN the App initialises on page load, THE App SHALL read all Transactions from Local Storage and render them in the Transaction_List, Balance_Display, and Chart.
4. IF Local Storage is empty, contains no Transaction data, or contains data that cannot be parsed as valid Transaction records, THEN THE App SHALL initialise with an empty Transaction_List and a zero Balance_Display without throwing a runtime error.
5. IF a new Transaction would cause the total number of persisted Transactions to exceed 1,000, THEN THE App SHALL reject the Transaction, display a message informing the user that the limit has been reached, and SHALL NOT write to Local Storage.

---

### Requirement 6: File and Code Structure

**User Story:** As a developer, I want the codebase to follow a strict single-file-per-type structure so that the project stays clean and maintainable.

#### Acceptance Criteria

1. THE App SHALL be structured with exactly one HTML file at the project root, exactly one CSS file inside a `css/` directory, and exactly one JavaScript file inside a `js/` directory, with no additional HTML, CSS, or JavaScript files anywhere in the project.
2. THE App SHALL NOT require a backend server, a build tool, a package manager, or a test framework to run; "run" means opening the single HTML file directly from the local filesystem in a browser.
3. THE App SHALL run in the latest stable versions of Chrome, Firefox, Edge, and Safari without producing JavaScript runtime errors, broken layouts, or non-functional interactive elements.

---

### Requirement 7: UI Responsiveness and Performance

**User Story:** As a user, I want the interface to load quickly and respond without lag so that using the app feels smooth and effortless.

#### Acceptance Criteria

1. THE App SHALL load and become interactive (all interactive controls enabled and Transaction_List visible) within 3 seconds when measured on a network connection of at least 25 Mbps download speed.
2. WHEN the user interacts with the Input_Form or deletes a Transaction, THE App SHALL reflect all UI changes (Transaction_List, Balance_Display, Chart) within 100 ms.
3. THE App SHALL render all interactive controls, text content, and the Transaction_List without layout overflow or hidden content on viewport widths between 320 px and 1920 px.
4. THE App SHALL render all text content at a minimum font size of 16 px and with a colour contrast ratio of at least 4.5:1 between text and its background.
