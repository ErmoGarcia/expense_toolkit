"""
Bank statement parsers for different bank formats.

Each parser takes a file path and returns a list of standardized transaction dicts:
{
    "transaction_date": date,
    "amount": Decimal,
    "currency": str,
    "raw_merchant_name": str,
    "raw_description": str,
    "external_id": str (optional, for deduplication)
}
"""
import hashlib
from abc import ABC, abstractmethod
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path
from typing import List, Dict, Any, Optional

import pandas as pd


class BankParser(ABC):
    """Base class for bank statement parsers"""
    
    bank_name: str = "Unknown"
    
    @abstractmethod
    def parse(self, filepath: Path) -> List[Dict[str, Any]]:
        """Parse the file and return standardized transactions"""
        pass
    
    @classmethod
    def can_parse(cls, filepath: Path) -> bool:
        """Check if this parser can handle the given file"""
        return False
    
    def generate_external_id(self, transaction: Dict[str, Any]) -> str:
        """Generate a unique ID for deduplication based on transaction data"""
        # Create a hash from date + amount + description
        id_string = f"{transaction['transaction_date']}|{transaction['amount']}|{transaction.get('raw_description', '')}"
        return hashlib.md5(id_string.encode()).hexdigest()[:16]


class RevolutParser(BankParser):
    """Parser for Revolut CSV exports"""
    
    bank_name = "Revolut"
    
    @classmethod
    def can_parse(cls, filepath: Path) -> bool:
        """Detect Revolut format by checking CSV headers"""
        if not filepath.suffix.lower() == '.csv':
            return False
        try:
            df = pd.read_csv(filepath, nrows=1)
            required_cols = {'Type', 'Description', 'Amount', 'Currency'}
            return required_cols.issubset(set(df.columns))
        except Exception:
            return False
    
    def parse(self, filepath: Path) -> List[Dict[str, Any]]:
        df = pd.read_csv(filepath)
        transactions = []
        
        for _, row in df.iterrows():
            # Skip non-completed transactions
            if row.get('State') != 'COMPLETED':
                continue
            
            # Parse dates - use Completed Date as the transaction date
            completed_date = row.get('Completed Date', row.get('Started Date'))
            if pd.isna(completed_date):
                continue
                
            try:
                trans_date = datetime.strptime(str(completed_date).split()[0], '%Y-%m-%d').date()
            except ValueError:
                continue
            
            # Parse amount
            amount = Decimal(str(row['Amount']))
            
            transaction = {
                'transaction_date': trans_date,
                'amount': amount,
                'currency': str(row.get('Currency', 'EUR')),
                'raw_merchant_name': str(row.get('Description', '')),
                'raw_description': f"{row.get('Type', '')} - {row.get('Description', '')}",
            }
            transaction['external_id'] = self.generate_external_id(transaction)
            transactions.append(transaction)
        
        return transactions


class BankinterParser(BankParser):
    """Parser for Bankinter XLSX exports"""
    
    bank_name = "Bankinter"
    
    @classmethod
    def can_parse(cls, filepath: Path) -> bool:
        """Detect Bankinter format by checking for specific header structure"""
        if filepath.suffix.lower() not in ['.xlsx', '.xls']:
            return False
        try:
            df = pd.read_excel(filepath, nrows=10)
            # Bankinter has "MOVIMIENTOS DE LA CUENTA" in first column header
            first_col = str(df.columns[0])
            return 'MOVIMIENTOS DE LA CUENTA' in first_col
        except Exception:
            return False
    
    def parse(self, filepath: Path) -> List[Dict[str, Any]]:
        # Read without header, we'll find the data rows manually
        df = pd.read_excel(filepath, header=None)
        
        # Find the header row (contains "Fecha contable")
        header_row = None
        for idx, row in df.iterrows():
            if any('Fecha contable' in str(cell) for cell in row):
                header_row = idx
                break
        
        if header_row is None:
            raise ValueError("Could not find header row in Bankinter file")
        
        # Set column names from header row
        df.columns = df.iloc[header_row].values
        df = df.iloc[header_row + 1:].reset_index(drop=True)
        
        transactions = []
        
        for _, row in df.iterrows():
            # Skip empty rows
            fecha = row.get('Fecha contable')
            if pd.isna(fecha):
                continue
            
            # Parse date (format: DD/MM/YYYY)
            try:
                if isinstance(fecha, datetime):
                    trans_date = fecha.date()
                else:
                    trans_date = datetime.strptime(str(fecha), '%d/%m/%Y').date()
            except ValueError:
                continue
            
            # Parse amount - Bankinter uses comma as decimal separator
            importe = row.get('Importe')
            if pd.isna(importe):
                continue
            
            try:
                if isinstance(importe, (int, float)):
                    amount = Decimal(str(importe))
                else:
                    # Handle string with comma decimal separator
                    amount_str = str(importe).replace('.', '').replace(',', '.')
                    amount = Decimal(amount_str)
            except Exception:
                continue
            
            description = str(row.get('Descripción', ''))
            currency = str(row.get('Divisa', 'EUR'))
            
            transaction = {
                'transaction_date': trans_date,
                'amount': amount,
                'currency': currency,
                'raw_merchant_name': description,
                'raw_description': description,
            }
            transaction['external_id'] = self.generate_external_id(transaction)
            transactions.append(transaction)
        
        return transactions


class BankinterCreditCardParser(BankParser):
    """Parser for Bankinter Credit Card XLS exports"""
    
    bank_name = "Bankinter Credit Card"
    
    @classmethod
    def can_parse(cls, filepath: Path) -> bool:
        """Detect Bankinter Credit Card format"""
        if filepath.suffix.lower() != '.xls':
            return False
        try:
            # Check it's a real XLS (not HTML)
            with open(filepath, 'rb') as f:
                header = f.read(100)
                if b'<html' in header.lower() or b'<!doctype' in header.lower():
                    return False
            
            # Try to read and check for credit card indicators
            df = pd.read_excel(filepath, engine='xlrd', nrows=5)
            first_col = str(df.columns[0])
            # Bankinter credit card has "Número de tarjeta" in first column
            return 'tarjeta' in first_col.lower()
        except Exception:
            return False
    
    def parse(self, filepath: Path) -> List[Dict[str, Any]]:
        df = pd.read_excel(filepath, engine='xlrd', header=None)
        
        transactions = []
        in_data_section = False
        
        for idx, row in df.iterrows():
            # Check for header row
            first_cell = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ''
            
            # Skip total/summary rows
            if 'Total' in first_cell:
                in_data_section = False
                continue
            
            # Detect header row (FECHA, COMERCIO/CAJERO, IMPORTE)
            if first_cell == 'FECHA':
                in_data_section = True
                continue
            
            # Skip non-data rows
            if not in_data_section:
                continue
            
            # Skip empty rows
            fecha = row.iloc[0]
            if pd.isna(fecha):
                continue
            
            # Parse date
            try:
                if isinstance(fecha, datetime):
                    trans_date = fecha.date()
                else:
                    trans_date = datetime.strptime(str(fecha).split()[0], '%Y-%m-%d').date()
            except ValueError:
                continue
            
            # Get merchant name
            comercio = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
            
            # Parse amount
            importe = row.iloc[2]
            if pd.isna(importe):
                continue
            
            try:
                if isinstance(importe, (int, float)):
                    amount = Decimal(str(importe))
                else:
                    amount_str = str(importe).replace('.', '').replace(',', '.')
                    amount = Decimal(amount_str)
            except Exception:
                continue
            
            transaction = {
                'transaction_date': trans_date,
                'amount': amount,
                'currency': 'EUR',
                'raw_merchant_name': comercio,
                'raw_description': comercio,
            }
            transaction['external_id'] = self.generate_external_id(transaction)
            transactions.append(transaction)
        
        return transactions


class OpenBankParser(BankParser):
    """Parser for OpenBank XLS exports (HTML table format)"""
    
    bank_name = "OpenBank"
    
    @classmethod
    def can_parse(cls, filepath: Path) -> bool:
        """Detect OpenBank format - it's HTML disguised as XLS"""
        if filepath.suffix.lower() != '.xls':
            return False
        try:
            # Check if it's actually HTML
            with open(filepath, 'rb') as f:
                header = f.read(100)
                return b'<html' in header.lower() or b'<!doctype' in header.lower()
        except Exception:
            return False
    
    def parse(self, filepath: Path) -> List[Dict[str, Any]]:
        # Read as HTML table
        tables = pd.read_html(filepath, encoding='iso-8859-1')
        
        if not tables:
            raise ValueError("No tables found in OpenBank file")
        
        df = tables[0]
        
        # Find the data header row (contains "Fecha Operación")
        header_row = None
        for idx in range(len(df)):
            row_values = [str(v) for v in df.iloc[idx].values if pd.notna(v)]
            if any('Fecha' in v and 'Operación' in v for v in row_values):
                header_row = idx
                break
        
        if header_row is None:
            raise ValueError("Could not find header row in OpenBank file")
        
        # Find the column indices for the fields we need
        header_values = df.iloc[header_row].values
        fecha_col = None
        concepto_col = None
        importe_col = None
        
        for i, val in enumerate(header_values):
            val_str = str(val).strip() if pd.notna(val) else ''
            if 'Fecha' in val_str and 'Operación' in val_str:
                fecha_col = i
            elif 'Concepto' in val_str:
                concepto_col = i
            elif 'Importe' in val_str:
                importe_col = i
        
        if fecha_col is None or importe_col is None:
            raise ValueError("Could not find required columns in OpenBank file")
        
        transactions = []
        
        # Process data rows (after header)
        for idx in range(header_row + 1, len(df)):
            row = df.iloc[idx]
            
            fecha = row.iloc[fecha_col] if fecha_col < len(row) else None
            if pd.isna(fecha):
                continue
            
            # Parse date (format: DD/MM/YYYY)
            try:
                trans_date = datetime.strptime(str(fecha).strip(), '%d/%m/%Y').date()
            except ValueError:
                continue
            
            # Parse amount - OpenBank may have various formats
            importe = row.iloc[importe_col] if importe_col < len(row) else None
            if pd.isna(importe):
                continue
            
            try:
                if isinstance(importe, (int, float)):
                    amount = Decimal(str(importe))
                else:
                    importe_str = str(importe).strip()
                    # Detect format: if has comma and dot, it's European (1.234,56)
                    # If has only dot, it's standard (1234.56)
                    # If has only comma, it's European without thousands (123,45)
                    if ',' in importe_str and '.' in importe_str:
                        # European format: 1.234,56 -> remove dots, replace comma
                        amount_str = importe_str.replace('.', '').replace(',', '.')
                    elif ',' in importe_str:
                        # European format without thousands: 123,45 -> replace comma
                        amount_str = importe_str.replace(',', '.')
                    else:
                        # Standard format: 1234.56 or integer
                        amount_str = importe_str
                    amount = Decimal(amount_str)
            except Exception:
                continue
            
            concepto = str(row.iloc[concepto_col]).strip() if concepto_col and concepto_col < len(row) else ''
            
            transaction = {
                'transaction_date': trans_date,
                'amount': amount,
                'currency': 'EUR',  # OpenBank is Spanish, EUR default
                'raw_merchant_name': concepto,
                'raw_description': concepto,
            }
            transaction['external_id'] = self.generate_external_id(transaction)
            transactions.append(transaction)
        
        return transactions


# Registry of all parsers
# Order matters - more specific parsers should come first
PARSERS = [
    RevolutParser,
    BankinterParser,
    BankinterCreditCardParser,
    OpenBankParser,
]


def detect_parser(filepath: Path) -> Optional[BankParser]:
    """Auto-detect the appropriate parser for a file"""
    for parser_cls in PARSERS:
        if parser_cls.can_parse(filepath):
            return parser_cls()
    return None


def parse_bank_file(filepath: Path) -> tuple[str, List[Dict[str, Any]]]:
    """
    Parse a bank file using auto-detection.
    Returns (bank_name, transactions) or raises ValueError if format unknown.
    """
    parser = detect_parser(filepath)
    if parser is None:
        raise ValueError(f"Unknown bank file format: {filepath.name}")
    
    transactions = parser.parse(filepath)
    return parser.bank_name, transactions
