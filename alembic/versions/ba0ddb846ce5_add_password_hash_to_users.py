"""add_password_hash_to_users

Revision ID: ba0ddb846ce5
Revises: 4da11b4d55cb
Create Date: 2025-01-20 02:14:46.258032

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba0ddb846ce5'
down_revision: Union[str, None] = '4da11b4d55cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
