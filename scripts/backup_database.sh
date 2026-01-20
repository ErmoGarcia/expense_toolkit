#!/bin/bash
#
# Expense Toolkit Database Backup Script
#
# This script creates a backup of the SQLite database using SQLite's .backup command,
# which is safer than simply copying the file as it ensures consistency.
# Backups are compressed with gzip and old backups are automatically cleaned up.
#
# Usage:
#   ./scripts/backup_database.sh
#
# Can be run manually or automated with systemd timer (see expense-toolkit-backup.timer)
#

set -e  # Exit on any error

# ============================================================================
# Configuration
# ============================================================================

# Project directory (adjust if needed)
PROJECT_DIR="/home/expenses/expense_toolkit"

# Database file location
DB_FILE="$PROJECT_DIR/data/expenses.db"

# Backup directory
BACKUP_DIR="$PROJECT_DIR/backups"

# Timestamp format for backup files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup filename
BACKUP_FILE="$BACKUP_DIR/expenses_${TIMESTAMP}.db"

# Number of days to keep backups
KEEP_DAYS=30

# ============================================================================
# Pre-flight Checks
# ============================================================================

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database file exists
if [ ! -f "$DB_FILE" ]; then
    echo "ERROR: Database file not found at $DB_FILE"
    echo "Please check the PROJECT_DIR and DB_FILE settings in this script"
    exit 1
fi

# Check if sqlite3 is installed
if ! command -v sqlite3 &> /dev/null; then
    echo "ERROR: sqlite3 command not found"
    echo "Please install SQLite: sudo apt-get install sqlite3"
    exit 1
fi

# ============================================================================
# Perform Backup
# ============================================================================

echo "=================================================="
echo "Expense Toolkit Database Backup"
echo "=================================================="
echo "Database: $DB_FILE"
echo "Backup to: $BACKUP_FILE"
echo "Timestamp: $(date)"
echo ""

# Use SQLite's .backup command for a consistent backup
# This is safer than copying the file directly
echo "Creating backup..."
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

if [ $? -ne 0 ]; then
    echo "ERROR: Backup command failed"
    exit 1
fi

# Verify backup file was created
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file was not created"
    exit 1
fi

echo "Backup created successfully"

# ============================================================================
# Compress Backup
# ============================================================================

echo "Compressing backup..."
gzip "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo "ERROR: Compression failed"
    exit 1
fi

# Update filename to include .gz extension
BACKUP_FILE="${BACKUP_FILE}.gz"

# Get backup file size
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup compressed: $SIZE"
else
    echo "ERROR: Compressed backup file not found"
    exit 1
fi

# ============================================================================
# Cleanup Old Backups
# ============================================================================

echo ""
echo "Cleaning up backups older than $KEEP_DAYS days..."

# Count backups before cleanup
BEFORE_COUNT=$(find "$BACKUP_DIR" -name "expenses_*.db.gz" | wc -l)

# Delete old backups
find "$BACKUP_DIR" -name "expenses_*.db.gz" -mtime +$KEEP_DAYS -delete

# Count backups after cleanup
AFTER_COUNT=$(find "$BACKUP_DIR" -name "expenses_*.db.gz" | wc -l)
DELETED_COUNT=$((BEFORE_COUNT - AFTER_COUNT))

if [ $DELETED_COUNT -gt 0 ]; then
    echo "Deleted $DELETED_COUNT old backup(s)"
fi

echo "Total backups retained: $AFTER_COUNT"

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=================================================="
echo "Backup completed successfully!"
echo "=================================================="
echo "Backup file: $BACKUP_FILE"
echo "Size: $SIZE"
echo "Total backups: $AFTER_COUNT"
echo ""

# List recent backups
echo "Recent backups:"
ls -lht "$BACKUP_DIR"/expenses_*.db.gz | head -5

exit 0
