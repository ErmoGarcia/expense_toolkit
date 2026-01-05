"""add archived column to expenses

Revision ID: b86e94e18547
Revises: 26cd2df52d58
Create Date: 2026-01-04 21:48:21.468942

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b86e94e18547'
down_revision: Union[str, None] = '26cd2df52d58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add archived column to expenses table
    with op.batch_alter_table('expenses', schema=None) as batch_op:
        batch_op.add_column(sa.Column('archived', sa.Boolean(), nullable=True, server_default='0'))


def downgrade() -> None:
    # Remove archived column from expenses table
    with op.batch_alter_table('expenses', schema=None) as batch_op:
        batch_op.drop_column('archived')
