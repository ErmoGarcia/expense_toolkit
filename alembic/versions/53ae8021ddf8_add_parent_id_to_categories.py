"""add parent_id to categories

Revision ID: 53ae8021ddf8
Revises: 92bfe0aba434
Create Date: 2026-01-04 21:49:09.963378

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '53ae8021ddf8'
down_revision: Union[str, None] = '92bfe0aba434'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add parent_id column to categories table for subcategory support
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.add_column(sa.Column('parent_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_categories_parent_id', 'categories', ['parent_id'], ['id'], ondelete='SET NULL')
        batch_op.create_index('idx_categories_parent_id', ['parent_id'], unique=False)


def downgrade() -> None:
    # Remove parent_id column from categories table
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.drop_index('idx_categories_parent_id')
        batch_op.drop_constraint('fk_categories_parent_id', type_='foreignkey')
        batch_op.drop_column('parent_id')
