# Filters and Select-All Feature Guide

This document describes the new filtering capabilities added to both the Expenses and Queue pages.

## Expenses Page Filters

The expenses page already had comprehensive filters implemented:

### Available Filters:
- **Category** - Filter by expense category
- **Tags** - Filter by tags
- **Account** - Filter by bank account
- **Date Range** - Start and end date
- **Search** - Search in merchant name or description

### Features:
- Filters update the expense list in real-time
- Pagination respects active filters
- Search has debouncing (500ms delay) for better performance
- Total amount calculation reflects filtered results

## Queue Page Filters

New filters have been added to the queue page to help manage unprocessed transactions.

### Available Filters:

#### Date Range
- **Date From** - Show transactions from this date onwards
- **Date To** - Show transactions up to this date

#### Amount Range
- **Amount Min (£)** - Minimum transaction amount (e.g., -100 for expenses)
- **Amount Max (£)** - Maximum transaction amount (e.g., 0 for expenses only)

#### Source
- **Source Filter** - Filter by import source (auto-populated from available sources)
- Options include: `test_import`, `xlsx_import`, `open_banking`, etc.

#### Search
- **Search** - Search in merchant name or raw description
- Debounced (500ms) for better performance

### Select-All Checkbox

A checkbox has been added to the queue table header that allows you to select/deselect all items.

**Key Features:**
- ✅ **Respects filters** - Only selects items visible with current filters
- ✅ **Three states**:
  - ☐ Unchecked - No items selected
  - ☑ Checked - All visible items selected
  - ◫ Indeterminate - Some visible items selected
- ✅ Works with bulk operations (Archive, Discard, Save, Group)

### How to Use

#### Basic Filtering:
1. Navigate to `/queue`
2. Use the filter section at the top of the page
3. Set your desired filters (dates, amounts, source, search)
4. The queue list updates automatically

#### Select-All with Filters:
1. Apply filters to narrow down the queue (e.g., date range, source)
2. Click the checkbox in the table header
3. All visible items will be selected
4. Use bulk actions (Archive, Save, Discard, Group)
5. Filters remain active after operations

#### Example Use Cases:

**Archive old transactions from specific source:**
```
1. Set "Date To" to a date 30 days ago
2. Set "Source" to "test_import"
3. Click select-all checkbox
4. Press "A" or click "Archive Selected"
```

**Find and discard small test transactions:**
```
1. Set "Amount Min" to -1
2. Set "Amount Max" to 0
3. Set "Source" to "test_import"
4. Click select-all checkbox
5. Press "X" or click "Discard Selected"
```

**Review expenses from specific merchant:**
```
1. Type merchant name in search box
2. Set date range if needed
3. Review and process individually or in bulk
```

## Backend Changes

### Queue Endpoint `/api/queue/all`

Now accepts query parameters:
- `date_from` (YYYY-MM-DD) - Filter by transaction date from
- `date_to` (YYYY-MM-DD) - Filter by transaction date to
- `amount_min` (float) - Filter by minimum amount
- `amount_max` (float) - Filter by maximum amount
- `source` (string) - Filter by import source
- `search` (string) - Search in merchant name or description

Example:
```
GET /api/queue/all?date_from=2025-11-01&date_to=2025-11-30&source=test_import
```

## Implementation Details

### Files Modified:

**Backend:**
- `app/routers/queue.py:29-67` - Added filter parameters to `/all` endpoint

**Frontend - Queue:**
- `app/static/queue.html:29-53` - Added filter section
- `app/static/js/queue.js:213-220` - Added filters property
- `app/static/js/queue.js:224` - Updated init to setup filters
- `app/static/js/queue.js:233-257` - Updated loadAllItems with filter params
- `app/static/js/queue.js:300-383` - Added setupFilterListeners and loadSourceOptions
- `app/static/js/queue.js:476-480` - Added select-all checkbox to header
- `app/static/js/queue.js:413-424` - Added toggleSelectAll method
- `app/static/js/queue.js:392-411` - Updated updateListUI for checkbox state

**Styling:**
- `app/static/css/styles.css:1449-1461` - Added queue filter styles

### Filter Behavior:

1. **Real-time updates** - Filters apply immediately
2. **Debounced search** - 500ms delay to reduce API calls
3. **State preservation** - Selected items cleared when filters change (for safety)
4. **Filter combination** - All filters work together (AND logic)
5. **Empty results** - Shows appropriate message when no items match

## Tips

- Use **date filters** to focus on recent or old transactions
- Use **amount filters** to find specific transaction types (e.g., all expenses < -£50)
- Use **source filter** to process imports from specific banks separately
- Use **search** to find transactions from specific merchants
- Combine filters for powerful querying (e.g., "Netflix transactions in December")
- Clear filters by refreshing or resetting individual filter fields

## Keyboard Shortcuts (Queue Page)

All existing shortcuts still work:
- `T` - Tools
- `R` - Rules
- `A` - Archive selected
- `S` - Save selected
- `G` - Group selected
- `X` - Discard selected
- `Space` - Toggle selection
- `Shift+↑↓` - Multi-select
- `Esc` - Clear selection

The select-all checkbox provides a mouse-friendly alternative to keyboard multi-select!
