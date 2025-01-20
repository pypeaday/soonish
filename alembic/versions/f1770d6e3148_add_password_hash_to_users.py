"""add_password_hash_to_users

Revision ID: f1770d6e3148
Revises: 62c63cc1c367
Create Date: 2025-01-20 02:11:37.873170

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1770d6e3148'
down_revision: Union[str, None] = '62c63cc1c367'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
