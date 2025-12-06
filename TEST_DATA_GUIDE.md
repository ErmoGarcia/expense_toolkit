# Test Data Guide

This document describes the test data added to your database for testing the new features.

## Summary

- **39 raw expenses** in the queue (unprocessed)
- **10 archived expenses** (saved with minimal data)
- **11 regular saved expenses** (fully processed)

## Test Scenarios

### 1. Duplicate Detection

The following duplicates have been created to test the duplicate detection feature:

#### Duplicate Set 1: Tesco Purchase (-£25.50)
- **RAW001**: Tesco - "Grocery shopping"
- **RAW006**: Tesco Metro - "Grocery shopping duplicate"
- Same date and amount, different merchant names

#### Duplicate Set 2: Shell Fuel (-£45.00)
- **RAW002**: Shell Petrol - "Fuel purchase"
- **RAW007**: Shell - "Fuel duplicate entry"
- Same date and amount, different merchant names

#### Duplicate Set 3: Netflix Subscription (-£12.99)
- **RAW003**: Netflix (raw, unprocessed) - "Monthly subscription"
- **Saved Expense**: Netflix (already processed) - "Netflix subscription"
- Same date and amount, one is saved, one is raw

### 2. Archive Testing

Three archived expenses have been created with:
- No merchant assignment (NULL)
- No category assignment (NULL)
- Various amounts: -£50.00, -£25.00, -£100.00
- Older dates (20-22 days ago)

These simulate old transactions you didn't process manually but kept for analysis.

### 3. Regular Queue Items

Additional raw expenses for general testing:
- Amazon (-£89.99) - Online shopping
- Costa Coffee (-£15.75) - Coffee and snacks
- Restaurant (-£67.50) - Dinner with friends
- Gym Membership (-£120.00) - Monthly gym fee
- Spotify (-£8.50) - Music subscription

## How to Test

### Testing Duplicate Detection

1. Navigate to **http://localhost:8000/queue**
2. Press **T** or click "Tools" button
3. Click **"Find Duplicates"**
4. You should see 3 items with red ⚠️ warning icons
5. Click any warning icon to see the comparison modal
6. Review duplicates side-by-side
7. Discard raw duplicates as needed (saved ones are protected)

### Testing Archive Functionality

1. Navigate to **http://localhost:8000/queue**
2. Select one or more items using:
   - **Space** to toggle selection
   - **Shift+Arrow** for multi-select
3. Press **A** or click "Archive Selected"
4. Confirm the action
5. Go to **http://localhost:8000/** (expenses page)
6. Verify archived items don't appear in the list

### Testing Regular Queue Processing

1. Navigate to **http://localhost:8000/queue**
2. Press **Enter** on any item to open detail view
3. Fill in merchant, category, description
4. Save the expense
5. Verify it's removed from queue

## Database Schema Notes

- All test data uses the same bank account
- Categories created: Groceries, Transport, Entertainment
- Merchant aliases created: Tesco, Shell, Netflix
- Currency: GBP for all transactions

## Cleanup

To remove all test data, you can run:

```bash
sqlite3 data/expenses.db "DELETE FROM raw_expenses WHERE source = 'test_import';"
sqlite3 data/expenses.db "DELETE FROM expenses WHERE bank_account_id = (SELECT id FROM bank_accounts WHERE name = 'Test Account') AND created_at > datetime('now', '-1 hour');"
```

Or simply delete the database and recreate it if you want a fresh start.
