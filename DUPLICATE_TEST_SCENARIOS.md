# Duplicate Detection Test Scenarios

This document describes all the duplicate test scenarios added to the database.

## Summary

Total test data in queue: **49 unprocessed raw expenses**

### Duplicate Scenarios Breakdown:

#### Original Duplicates (from add_test_data.py):
1. **Tesco Duplicate** (-£25.50, same date)
   - RAW001: Tesco - "Grocery shopping"
   - RAW006: Tesco Metro - "Grocery shopping duplicate"

2. **Shell Duplicate** (-£45.00, same date)
   - RAW002: Shell Petrol - "Fuel purchase"
   - RAW007: Shell - "Fuel duplicate entry"

3. **Netflix Duplicate** (-£12.99, same date)
   - RAW003: Netflix (raw) - "Monthly subscription"
   - Saved Expense: Netflix (processed) - "Netflix subscription"

#### New Advanced Duplicate Scenarios:

### 1. Triple Duplicate (-£15.99)
**Date:** Same date for all 3
- DUP001: Starbucks Main St - "Coffee"
- DUP002: Starbucks Coffee - "Morning coffee"
- DUP003: Starbucks - "Latte and muffin"

**Purpose:** Test handling of 3+ duplicates of same transaction

---

### 2. Raw + Saved Duplicate (-£9.99)
**Date:** Same date
- DUP004: Apple.com/bill (raw) - "Apple subscription"
- Saved Expense: Apple Subscription (already processed)

**Purpose:** Test duplicate detection between unprocessed and saved expenses

---

### 3. Multiple Duplicate Pairs

**Pair A: Sainsbury's (-£35.00)**
**Date:** Same date
- DUP005: Sainsburys - "Groceries" (source: test_import)
- DUP006: Sainsbury's Local - "Weekly shop" (source: xlsx_import)

**Pair B: Pret (-£7.50)**
**Date:** Same date
- DUP007: Pret A Manger - "Lunch"
- DUP008: Pret - "Sandwich and drink"

**Purpose:** Test multiple independent duplicate pairs

---

### 4. Income Duplicates (+£500.00)
**Date:** Same date
- DUP009: Freelance Client Ltd - "Payment received" (test_import)
- DUP010: Freelance Client - "Invoice payment" (xlsx_import)

**Purpose:** Test duplicate detection for positive amounts (income)

---

### 5. Near-Duplicates (NOT Real Duplicates)
**Date:** Same date, **different amounts**
- NEAR001: Uber Ride - £20.00 - "Trip to airport"
- NEAR002: Uber - £20.50 - "Ride home"

**Purpose:** Verify these are NOT flagged as duplicates (amounts differ)

---

### 6. Same Amount, Different Dates (NOT Real Duplicates)
**Dates:** Different dates, same amount
- SAME001: Fast Food A - £10.00 (date 1)
- SAME002: Fast Food B - £10.00 (date 2)

**Purpose:** Verify these are NOT flagged as duplicates (dates differ)

---

## Testing the Duplicate Features

### Basic Duplicate Detection:

1. Navigate to `/queue`
2. Click **Tools (T)** button
3. Click **"Find Duplicates"**
4. Observe duplicate indicators (⚠️) appear on items

### Using the "Show Duplicates Only" Filter:

1. Navigate to `/queue`
2. Run "Find Duplicates" first (Tools > Find Duplicates)
3. Check the **"Show Duplicates Only"** checkbox in filters
4. Queue list will show ONLY items with duplicates

### Expected Results:

**Should show duplicates:**
- 3 Starbucks transactions (-£15.99) - Triple duplicate
- 2 Tesco transactions (-£25.50) - Original pair
- 2 Shell transactions (-£45.00) - Original pair
- Netflix raw + saved (-£12.99) - Raw vs Saved
- Apple raw + saved (-£9.99) - Raw vs Saved
- 2 Sainsbury's transactions (-£35.00) - Pair A
- 2 Pret transactions (-£7.50) - Pair B
- 2 Freelance Client transactions (+£500.00) - Income duplicates

**Should NOT show duplicates:**
- Uber transactions (different amounts: £20.00 vs £20.50)
- Fast Food transactions (different dates)

### Testing Duplicate Review Modal:

1. Click ⚠️ icon on any duplicate item
2. Review side-by-side comparison
3. Verify:
   - Current transaction highlighted in blue border
   - Saved expenses highlighted in blue background
   - "Discard This" button only on raw expenses
   - Saved expenses protected (no discard button)

### Testing Duplicate Discard:

1. Open duplicate modal
2. Click "Discard This" on a raw expense
3. Verify:
   - Item removed from queue
   - Item removed from duplicates list of other items
   - If no duplicates remain, warning icon disappears

### Filter Combinations:

Try these combinations:

**Find old test data duplicates:**
```
Source: test_import
Show Duplicates Only: ✓
```

**Find duplicate income:**
```
Amount Min: 0
Show Duplicates Only: ✓
```

**Find recent duplicates:**
```
Date From: (last week)
Show Duplicates Only: ✓
```

**Search specific merchant duplicates:**
```
Search: Starbucks
Show Duplicates Only: ✓
```

## Database Statistics

- **Total raw expenses in queue:** 49
- **Duplicate sets:** 8 (some with 2 items, one with 3 items)
- **Non-duplicate items:** 41
- **Items with duplicates:** ~13 (depends on saved expense matches)

## Cleanup

To remove all duplicate test data:

```bash
sqlite3 data/expenses.db "DELETE FROM raw_expenses WHERE external_id LIKE 'DUP%' OR external_id LIKE 'NEAR%' OR external_id LIKE 'SAME%';"
```

Or remove all test data:

```bash
sqlite3 data/expenses.db "DELETE FROM raw_expenses WHERE source IN ('test_import', 'duplicates.csv');"
```
