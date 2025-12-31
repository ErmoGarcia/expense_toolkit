# Code Review: Major Pitfalls & Critical Edge Cases

**Review Date:** December 24, 2025  
**Status:** In Progress - Many issues fixed

## Overview

This document tracks all identified issues in the codebase, organized by priority and implementation status.

---

## Issue Summary

| Severity | Total | Fixed | Deferred |
|----------|-------|-------|----------|
| CRITICAL | 11 | 11 | 0 |
| HIGH | 30+ | 25+ | 5 |
| MEDIUM | 25+ | 10 | 10+ |
| LOW | 10+ | 4 | 5+ |

---

## Completed Fixes (December 24, 2025)

### Backend - Pydantic Validation (COMPLETED)
All API endpoints now use Pydantic models for request validation:
- `app/schemas.py` - Created comprehensive schema definitions
- `app/routers/categories.py` - Uses `CategoryCreate`, `CategoryUpdate`, `CategoryResponse`
- `app/routers/merchants.py` - Uses `MerchantCreate`, `MerchantResponse`
- `app/routers/tags.py` - Uses `TagCreate`, `TagResponse`
- `app/routers/rules.py` - Uses `RuleCreate`, `RuleUpdate`, `RuleResponse`
- `app/routers/expenses.py` - Uses `ExpenseUpdate` (prevents mass assignment)
- `app/routers/queue.py` - Uses `ProcessExpenseRequest`, `ArchiveExpensesRequest`, `MergeExpensesRequest`
- `app/routers/import_xlsx.py` - Added file size limit (10MB) and improved validation

### Backend - Pagination Limits (COMPLETED)
- `app/routers/expenses.py` - Added `MAX_LIMIT = 500` with `le=MAX_LIMIT` constraint
- `app/routers/queue.py` - Added similar limits

### Frontend - XSS Prevention (COMPLETED)
- `app/static/js/utils.js` - Created shared utilities:
  - `escapeHtml()` - Sanitizes content for innerHTML
  - `escapeAttr()` - Sanitizes for HTML attributes
  - `escapeJs()` - Sanitizes for JavaScript strings
  - `apiFetch()` - Wrapper with response.ok checking
  - `formatCurrency()` - Consistent currency formatting
  - `showToast()` - Non-blocking notifications (replaces alert())
- `app/static/js/categories.js` - Fixed all XSS vulnerabilities, added response.ok checks
- `app/static/js/expenses.js` - Fixed all XSS vulnerabilities, added response.ok checks
- `app/static/js/import.js` - Fixed all XSS vulnerabilities, added response.ok checks
- `app/static/js/queue.js` - Fixed all XSS vulnerabilities, added response.ok checks
- `app/static/js/notifications.js` - Fixed all XSS vulnerabilities, added response.ok checks
- All HTML files updated to include `utils.js`

### Frontend - Response Handling (COMPLETED)
- Added `response.ok` checks with proper error handling in all JS files:
  - `categories.js`
  - `expenses.js`
  - `import.js`
  - `queue.js`
  - `notifications.js`
- Replaced many `alert()` calls with `showToast()` for better UX

---

## Deferred Issues (Future Implementation)

These issues are tracked but deferred for now. They should be addressed before making the app publicly accessible.

### Authentication & Authorization
- **Status:** Deferred (local network use only)
- **Priority for Public Release:** CRITICAL
- **Description:** No authentication on any endpoint. Anyone can access, modify, or delete all data.
- **Affected Files:** All files in `app/routers/`
- **Recommendation:** Implement OAuth2/JWT authentication with role-based access control

### Concurrency & Race Conditions
- **Status:** Deferred (single user)
- **Priority for Public Release:** HIGH
- **Locations:**
  - `app/routers/queue.py:161-230` - TOCTOU in expense processing
  - `app/routers/queue.py:467-491` - Race condition in merge endpoint
  - `app/routers/notifications.py:321-381` - Race condition in notification processing
  - `app/database.py:7-10` - SQLite `check_same_thread=False` can cause issues under load
- **Recommendation:** 
  - Use database-level locking or unique constraints with proper exception handling
  - Consider migrating to PostgreSQL for production use
  - Add proper connection pooling

### Logging
- **Status:** Deferred
- **Priority for Public Release:** HIGH
- **Description:** Zero logging anywhere in the codebase
- **Recommendation:** Add structured logging using Python's `logging` module or `loguru`

### Testing
- **Status:** Deferred
- **Priority for Public Release:** HIGH
- **Description:** No test suite exists
- **Recommendation:** Add pytest with coverage for:
  - Bank parsers (unit tests)
  - API endpoints (integration tests)
  - Frontend (Playwright/Cypress e2e tests)

### Rate Limiting
- **Status:** Deferred (local network use only)
- **Priority for Public Release:** HIGH
- **Description:** No rate limiting on any endpoints
- **Recommendation:** Add `slowapi` or similar rate limiting middleware

### CORS Configuration
- **Status:** Deferred
- **Priority for Public Release:** MEDIUM
- **Description:** No CORS middleware configured
- **Location:** `app/main.py`
- **Recommendation:** Add explicit CORS configuration before public release

### Soft Delete Pattern
- **Status:** Deferred
- **Priority for Public Release:** LOW
- **Description:** All models use hard delete with no audit trail
- **Recommendation:** Add `deleted_at` column and filter queries accordingly

---

## Remaining Issues To Fix

### 1. Decimal to Float Conversion
- **Severity:** MEDIUM
- **Status:** TODO
- **Location:** `app/services/notification_parser.py:99-115`
- **Problem:** `Decimal` converted to `float`, loses precision
- **Solution:** Keep as `Decimal` or use string representation

### 2. Hardcoded Currency
- **Severity:** MEDIUM
- **Status:** PARTIALLY FIXED
- **Locations:**
  - `app/services/notification_parser.py:116` - Hardcoded "EUR"
  - Frontend now uses `formatCurrency()` from utils.js which supports GBP/EUR/USD
- **Solution:** Make currency configurable in settings

### 3. Silent Exception Swallowing
- **Severity:** MEDIUM
- **Status:** TODO
- **Location:** `app/services/notification_parser.py:129-131, 161-162`
- **Problem:** Exceptions caught and silently ignored
- **Solution:** At minimum, log the exception (when logging is added)

### 4. Weak External ID Generation
- **Severity:** MEDIUM
- **Status:** TODO
- **Location:** `app/services/bank_parsers.py:39-43`
- **Problem:** MD5 (broken), only 16 chars, collision-prone
- **Solution:** Use SHA-256, include more unique fields, use full hash

### 5. ReDoS Vulnerability
- **Severity:** MEDIUM
- **Status:** PARTIALLY FIXED
- **Location:** `app/routers/queue.py:347-351`
- **Change:** Added pattern length limit (500 chars) as basic protection
- **Recommendation:** For full protection, use `regex` library with timeout

### 6. Deprecated FastAPI Pattern
- **Severity:** LOW
- **Status:** TODO
- **Location:** `app/main.py:13-15`
- **Problem:** `@app.on_event("startup")` is deprecated
- **Solution:** Use lifespan context manager

---

## Recently Completed Fixes

### Database Model Improvements (COMPLETED)
- **Rule model:** Changed `created_at` and `updated_at` from `Text` to `DateTime(timezone=True)`
- **Notification model:** Added proper `ForeignKey` for `raw_expense_id` with `ondelete="SET NULL"`
- **All models:** Added `ondelete="SET NULL"` to foreign keys to prevent orphaned references:
  - `Expense.raw_expense_id`, `category_id`, `merchant_alias_id`, `bank_account_id`, `parent_expense_id`
  - `RawExpense.bank_account_id`
  - `Category.parent_id`
  - `MerchantAlias.default_category_id`

### Database Indexes (COMPLETED)
Added indexes for frequently filtered columns via `migrate_december_2024.py`:
- `raw_expenses.source`
- `expenses.category_id`
- `expenses.merchant_alias_id`
- `expenses.archived`
- `raw_notifications.is_processed`

---

## Frontend-Specific Issues

### Memory Leaks
- **Severity:** MEDIUM
- **Status:** PARTIALLY ADDRESSED
- **Notes:** 
  - `import.js` now uses event delegation instead of adding listeners on each reload
  - Other files still have potential leaks

### No AbortController
- **Severity:** MEDIUM
- **Status:** TODO
- **Locations:** All JS files
- **Problem:** Stale requests can return after newer ones, showing old data
- **Solution:** Use `AbortController` to cancel pending requests

### Alert() Usage
- **Severity:** LOW
- **Status:** PARTIALLY FIXED
- **Notes:** 
  - Added `showToast()` utility
  - Updated categories.js, expenses.js, import.js to use toasts
  - queue.js still uses alert() for some confirmations (intentional for destructive actions)

---

## Critical Edge Cases to Handle

1. ~~**XSS in merchant name**~~ - FIXED with escapeHtml()
2. ~~**Non-JSON error response**~~ - FIXED with response.ok checks
3. **Duplicate expense processing** - Deferred (single user)
4. ~~**Large file upload**~~ - FIXED with 10MB limit
5. **Database lock** - Deferred (single user)
6. ~~**Orphaned references**~~ - FIXED with ondelete="SET NULL"
7. **ReDoS attack** - Partially mitigated with length limit
8. **Rapid button clicks** - TODO
9. **Bank format change** - TODO (better error handling)
10. **Decimal precision** - TODO

---

## Migration Notes

When migrating to production/public use:

1. **Database:** Consider migrating from SQLite to PostgreSQL
2. **Authentication:** Implement OAuth2/JWT before any public access
3. **Logging:** Add before deploying to troubleshoot issues
4. **Rate Limiting:** Essential for any public-facing API
5. **File Validation:** Validate file contents, not just extensions
6. **Alembic:** Replace manual migrations with proper versioned migrations

---

## Changelog

### 2024-12-24
- Initial code review completed
- Identified 76+ issues across codebase
- Prioritized issues for immediate fix vs deferred

### 2024-12-24 (Update 1)
- Created `app/schemas.py` with Pydantic models for all endpoints
- Updated all routers to use Pydantic validation (prevents mass assignment)
- Added file upload size limit (10MB) in import_xlsx.py
- Added pagination limits to expenses and queue routers
- Created `app/static/js/utils.js` with:
  - `escapeHtml()`, `escapeAttr()`, `escapeJs()` for XSS prevention
  - `apiFetch()` wrapper with proper error handling
  - `formatCurrency()` for consistent currency display
  - `showToast()` for non-blocking notifications
- Fixed XSS vulnerabilities in categories.js, expenses.js, import.js
- Added response.ok checks throughout fixed JS files
- Updated all HTML files to include utils.js

### 2024-12-24 (Update 2)
- Fixed all XSS vulnerabilities in queue.js:
  - Autocomplete suggestions
  - List view rendering
  - Bulk items preview
  - Tag rendering with onclick handlers
  - Rules list rendering
  - Raw transaction display
  - Merge items preview
  - Duplicate cards rendering
  - Category options
  - Error messages
- Added response.ok checks to all fetch calls in queue.js
- Fixed XSS vulnerabilities in notifications.js
- All frontend XSS issues now resolved

### 2024-12-24 (Update 3)
- Fixed Rule model DateTime types (Text -> DateTime)
- Added proper ForeignKey for raw_expense_id in notification model
- Added ondelete="SET NULL" to all foreign keys in models to handle cascade deletes
- Added database indexes for performance:
  - raw_expenses.source
  - expenses.category_id, merchant_alias_id, archived
  - raw_notifications.is_processed
- Created `migrate_december_2024.py` migration script
