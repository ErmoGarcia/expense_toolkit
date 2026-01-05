"""add type column and remove periodic_expenses

Revision ID: 9fe63888ef96
Revises: 53ae8021ddf8
Create Date: 2026-01-04 21:49:35.463263

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9fe63888ef96'
down_revision: Union[str, None] = '53ae8021ddf8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop periodic_expenses table if it exists (legacy table)
    op.execute("DROP TABLE IF EXISTS periodic_expenses")
    
    # Add type column to expenses table
    with op.batch_alter_table('expenses', schema=None) as batch_op:
        batch_op.add_column(sa.Column('type', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('parent_expense_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_expenses_parent_expense_id', 'expenses', ['parent_expense_id'], ['id'], ondelete='SET NULL')
    
    # Add type column to raw_expenses table
    with op.batch_alter_table('raw_expenses', schema=None) as batch_op:
        batch_op.add_column(sa.Column('type', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove type column from raw_expenses table
    with op.batch_alter_table('raw_expenses', schema=None) as batch_op:
        batch_op.drop_column('type')
    
    # Remove type and parent_expense_id columns from expenses table
    with op.batch_alter_table('expenses', schema=None) as batch_op:
        batch_op.drop_constraint('fk_expenses_parent_expense_id', type_='foreignkey')
        batch_op.drop_column('parent_expense_id')
        batch_op.drop_column('type')
    
    # Note: We don't recreate periodic_expenses table in downgrade
    # as it's a legacy feature that was removed
