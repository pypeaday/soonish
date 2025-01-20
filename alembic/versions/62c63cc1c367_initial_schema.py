"""initial_schema

Revision ID: 62c63cc1c367
Revises:
Create Date: 2025-01-20 01:29:42.384759

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "62c63cc1c367"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("oauth_provider", sa.String(), nullable=True),
        sa.Column("oauth_id", sa.String(), nullable=True),
        sa.Column("password_hash", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_unique_constraint(None, "users", ["oauth_id"])

    # Create categories table
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_categories_id"), "categories", ["id"], unique=False)
    op.create_index(op.f("ix_categories_name"), "categories", ["name"], unique=False)

    # Create events table
    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_date", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("notify_before", sa.Integer(), nullable=True),
        sa.Column("is_recurring", sa.Boolean(), nullable=True),
        sa.Column("recurrence_pattern", sa.String(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_events_id"), "events", ["id"], unique=False)
    op.create_index(op.f("ix_events_title"), "events", ["title"], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index(op.f("ix_events_title"), table_name="events")
    op.drop_index(op.f("ix_events_id"), table_name="events")
    op.drop_table("events")

    op.drop_index(op.f("ix_categories_name"), table_name="categories")
    op.drop_index(op.f("ix_categories_id"), table_name="categories")
    op.drop_table("categories")

    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
