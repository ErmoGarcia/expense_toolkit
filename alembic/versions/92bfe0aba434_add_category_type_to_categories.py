"""add category_type to categories

Revision ID: 92bfe0aba434
Revises: b86e94e18547
Create Date: 2026-01-04 21:48:44.722611

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '92bfe0aba434'
down_revision: Union[str, None] = 'b86e94e18547'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add category_type column to categories table with default value 'expense'
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.add_column(sa.Column('category_type', sa.String(), nullable=True, server_default='expense'))
    
    # Update existing categories to have 'expense' type
    op.execute("UPDATE categories SET category_type = 'expense' WHERE category_type IS NULL")


def downgrade() -> None:
    # Remove category_type column from categories table
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.drop_column('category_type')
