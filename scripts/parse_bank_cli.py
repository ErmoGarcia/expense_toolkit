#!/usr/bin/env python3
"""
CLI script to test the parse_bank_file function.

Usage:
    python parse_bank_cli.py <filename> [--limit N]

Examples:
    python parse_bank_cli.py imports/xlsx/movimientos.xls
    python parse_bank_cli.py imports/xlsx/movimientos.xls --limit 5
"""
import argparse
import sys
from pathlib import Path

from app.services.bank_parsers import parse_bank_file


def main():
    parser = argparse.ArgumentParser(
        description="Parse a bank statement file and print transactions."
    )
    parser.add_argument("filename", help="Path to the bank file to parse")
    parser.add_argument(
        "--limit", "-l",
        type=int,
        default=10,
        help="Maximum number of transactions to display (default: 10)"
    )
    parser.add_argument(
        "--all", "-a",
        action="store_true",
        help="Show all transactions (ignore limit)"
    )
    
    args = parser.parse_args()
    
    filepath = Path(args.filename)
    if not filepath.exists():
        print(f"Error: File not found: {filepath}", file=sys.stderr)
        sys.exit(1)
    
    try:
        bank_name, transactions = parse_bank_file(filepath)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error parsing file: {e}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Bank: {bank_name}")
    print(f"Total transactions: {len(transactions)}")
    print("-" * 80)
    
    display_count = len(transactions) if args.all else min(args.limit, len(transactions))
    
    for i, tx in enumerate(transactions[:display_count]):
        print(f"\n[{i + 1}] {tx['transaction_date']} | {tx['amount']:>10} {tx['currency']}")
        print(f"    Merchant: {tx['raw_merchant_name'][:60]}")
        if tx['raw_description'] != tx['raw_merchant_name']:
            print(f"    Description: {tx['raw_description'][:60]}")
        print(f"    ID: {tx['external_id']}")
    
    if not args.all and len(transactions) > args.limit:
        print(f"\n... and {len(transactions) - args.limit} more transactions (use --all to see all)")


if __name__ == "__main__":
    main()
