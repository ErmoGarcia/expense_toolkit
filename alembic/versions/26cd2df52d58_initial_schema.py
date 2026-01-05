"""initial schema

Revision ID: 26cd2df52d58
Revises: 
Create Date: 2026-01-04 21:47:15.468055

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '26cd2df52d58'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create bank_accounts table
    op.create_table(
        'bank_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('bank_name', sa.String(), nullable=True),
        sa.Column('account_type', sa.String(), nullable=True),
        sa.Column('gocardless_requisition_id', sa.String(), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bank_accounts_id'), 'bank_accounts', ['id'], unique=False)
    
    # Create categories table (without category_type and parent_id - those come later)
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('icon', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_categories_id'), 'categories', ['id'], unique=False)
    op.create_index(op.f('ix_categories_name'), 'categories', ['name'], unique=True)
    
    # Create tags table
    op.create_table(
        'tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tags_id'), 'tags', ['id'], unique=False)
    op.create_index(op.f('ix_tags_name'), 'tags', ['name'], unique=True)
    
    # Create merchant_aliases table
    op.create_table(
        'merchant_aliases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('raw_name', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('default_category_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['default_category_id'], ['categories.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_merchant_aliases_id'), 'merchant_aliases', ['id'], unique=False)
    op.create_index(op.f('ix_merchant_aliases_raw_name'), 'merchant_aliases', ['raw_name'], unique=True)
    
    # Create import_history table
    op.create_table(
        'import_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('stored_filename', sa.String(), nullable=True),
        sa.Column('bank_account_id', sa.Integer(), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('records_imported', sa.Integer(), nullable=True),
        sa.Column('records_skipped', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('imported_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['bank_account_id'], ['bank_accounts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_import_history_id'), 'import_history', ['id'], unique=False)
    
    # Create raw_expenses table (without type, tags, category_id, merchant_alias_id, description - those come later)
    op.create_table(
        'raw_expenses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bank_account_id', sa.Integer(), nullable=True),
        sa.Column('external_id', sa.String(), nullable=True),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(), nullable=True),
        sa.Column('raw_merchant_name', sa.String(), nullable=True),
        sa.Column('raw_description', sa.String(), nullable=True),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('source_file', sa.String(), nullable=True),
        sa.Column('imported_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['bank_account_id'], ['bank_accounts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('bank_account_id', 'external_id', name='uix_bank_external')
    )
    op.create_index(op.f('ix_raw_expenses_id'), 'raw_expenses', ['id'], unique=False)
    op.create_index(op.f('ix_raw_expenses_transaction_date'), 'raw_expenses', ['transaction_date'], unique=False)
    
    # Create raw_notifications table
    op.create_table(
        'raw_notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('app_package', sa.String(), nullable=True),
        sa.Column('app_name', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('notification_timestamp', sa.DateTime(timezone=True), nullable=True),
        sa.Column('raw_payload', sa.Text(), nullable=True),
        sa.Column('source_file', sa.String(), nullable=True),
        sa.Column('is_processed', sa.Boolean(), nullable=True),
        sa.Column('is_expense', sa.Boolean(), nullable=True),
        sa.Column('raw_expense_id', sa.Integer(), nullable=True),
        sa.Column('parse_error', sa.String(), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['raw_expense_id'], ['raw_expenses.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_raw_notifications_id'), 'raw_notifications', ['id'], unique=False)
    
    # Create rules table
    op.create_table(
        'rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=True),
        sa.Column('field', sa.String(), nullable=False),
        sa.Column('match_type', sa.String(), nullable=False),
        sa.Column('match_value', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('save_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rules_id'), 'rules', ['id'], unique=False)
    
    # Create expenses table (without archived, type, parent_expense_id - those come later)
    op.create_table(
        'expenses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('raw_expense_id', sa.Integer(), nullable=True),
        sa.Column('bank_account_id', sa.Integer(), nullable=True),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(), nullable=True),
        sa.Column('merchant_alias_id', sa.Integer(), nullable=True),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('is_recurring', sa.Boolean(), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['bank_account_id'], ['bank_accounts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['merchant_alias_id'], ['merchant_aliases.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['raw_expense_id'], ['raw_expenses.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('raw_expense_id')
    )
    op.create_index(op.f('ix_expenses_id'), 'expenses', ['id'], unique=False)
    op.create_index(op.f('ix_expenses_transaction_date'), 'expenses', ['transaction_date'], unique=False)
    
    # Create expense_tags junction table
    op.create_table(
        'expense_tags',
        sa.Column('expense_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['expense_id'], ['expenses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('expense_id', 'tag_id')
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('expense_tags')
    op.drop_index(op.f('ix_expenses_transaction_date'), table_name='expenses')
    op.drop_index(op.f('ix_expenses_id'), table_name='expenses')
    op.drop_table('expenses')
    op.drop_index(op.f('ix_rules_id'), table_name='rules')
    op.drop_table('rules')
    op.drop_index(op.f('ix_raw_notifications_id'), table_name='raw_notifications')
    op.drop_table('raw_notifications')
    op.drop_index(op.f('ix_raw_expenses_transaction_date'), table_name='raw_expenses')
    op.drop_index(op.f('ix_raw_expenses_id'), table_name='raw_expenses')
    op.drop_table('raw_expenses')
    op.drop_index(op.f('ix_import_history_id'), table_name='import_history')
    op.drop_table('import_history')
    op.drop_index(op.f('ix_merchant_aliases_raw_name'), table_name='merchant_aliases')
    op.drop_index(op.f('ix_merchant_aliases_id'), table_name='merchant_aliases')
    op.drop_table('merchant_aliases')
    op.drop_index(op.f('ix_tags_name'), table_name='tags')
    op.drop_index(op.f('ix_tags_id'), table_name='tags')
    op.drop_table('tags')
    op.drop_index(op.f('ix_categories_name'), table_name='categories')
    op.drop_index(op.f('ix_categories_id'), table_name='categories')
    op.drop_table('categories')
    op.drop_index(op.f('ix_bank_accounts_id'), table_name='bank_accounts')
    op.drop_table('bank_accounts')
