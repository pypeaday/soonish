"""add_password_hash_to_users

Revision ID: 4da11b4d55cb
Revises: f1770d6e3148
Create Date: 2025-01-20 02:13:12.426107

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4da11b4d55cb'
down_revision: Union[str, None] = 'f1770d6e3148'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
