"""add update mode fields to raw_expenses

Revision ID: 7259ab9ce063
Revises: 9fe63888ef96
Create Date: 2026-01-04 21:50:03.582425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7259ab9ce063'
down_revision: Union[str, None] = '9fe63888ef96'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add update mode fields to raw_expenses table
    with op.batch_alter_table('raw_expenses', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tags', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('category_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('merchant_alias_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('description', sa.String(), nullable=True))
        batch_op.create_foreign_key('fk_raw_expenses_category_id', 'categories', ['category_id'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key('fk_raw_expenses_merchant_alias_id', 'merchant_aliases', ['merchant_alias_id'], ['id'], ondelete='SET NULL')
        batch_op.create_index('ix_raw_expenses_category_id', ['category_id'], unique=False)
        batch_op.create_index('ix_raw_expenses_merchant_alias_id', ['merchant_alias_id'], unique=False)
    
    # Set default value for tags column
    op.execute("UPDATE raw_expenses SET tags = '[]' WHERE tags IS NULL")


def downgrade() -> None:
    # Remove update mode fields from raw_expenses table
    with op.batch_alter_table('raw_expenses', schema=None) as batch_op:
        batch_op.drop_index('ix_raw_expenses_merchant_alias_id')
        batch_op.drop_index('ix_raw_expenses_category_id')
        batch_op.drop_constraint('fk_raw_expenses_merchant_alias_id', type_='foreignkey')
        batch_op.drop_constraint('fk_raw_expenses_category_id', type_='foreignkey')
        batch_op.drop_column('description')
        batch_op.drop_column('merchant_alias_id')
        batch_op.drop_column('category_id')
        batch_op.drop_column('tags')
