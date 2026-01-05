"""add december 2024 performance indexes

Revision ID: f35d9c222f2a
Revises: 7259ab9ce063
Create Date: 2026-01-04 21:50:31.635266

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f35d9c222f2a'
down_revision: Union[str, None] = '7259ab9ce063'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add index on raw_expenses.source for faster filtering
    op.create_index('ix_raw_expenses_source', 'raw_expenses', ['source'], unique=False)
    
    # Add index on expenses.category_id for faster category filtering
    op.create_index('ix_expenses_category_id', 'expenses', ['category_id'], unique=False)
    
    # Add index on expenses.merchant_alias_id for faster merchant filtering
    op.create_index('ix_expenses_merchant_alias_id', 'expenses', ['merchant_alias_id'], unique=False)
    
    # Add index on expenses.archived for faster active/archived filtering
    op.create_index('ix_expenses_archived', 'expenses', ['archived'], unique=False)
    
    # Add index on raw_notifications.is_processed for faster queue queries
    op.create_index('ix_raw_notifications_is_processed', 'raw_notifications', ['is_processed'], unique=False)


def downgrade() -> None:
    # Remove all performance indexes
    op.drop_index('ix_raw_notifications_is_processed', table_name='raw_notifications')
    op.drop_index('ix_expenses_archived', table_name='expenses')
    op.drop_index('ix_expenses_merchant_alias_id', table_name='expenses')
    op.drop_index('ix_expenses_category_id', table_name='expenses')
    op.drop_index('ix_raw_expenses_source', table_name='raw_expenses')
