"""add categories

Revision ID: add_categories
Revises:
Create Date: 2025-01-18 16:42:18.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "add_categories"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create categories table
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_categories_id"), "categories", ["id"], unique=False)
    op.create_index(op.f("ix_categories_name"), "categories", ["name"], unique=False)

    # Add category_id to events table
    op.add_column("events", sa.Column("category_id", sa.Integer(), nullable=True))
    op.create_foreign_key(None, "events", "categories", ["category_id"], ["id"])


def downgrade() -> None:
    # Remove category_id from events table
    op.drop_constraint(None, "events", type_="foreignkey")
    op.drop_column("events", "category_id")

    # Drop categories table
    op.drop_index(op.f("ix_categories_name"), table_name="categories")
    op.drop_index(op.f("ix_categories_id"), table_name="categories")
    op.drop_table("categories")
