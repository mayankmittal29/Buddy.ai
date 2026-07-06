"""rename certification status values to pending completed

Revision ID: 2b5c3a6467d7
Revises: f54deaff5ae9
Create Date: 2026-07-06 16:07:27.498491

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b5c3a6467d7'
down_revision: Union[str, Sequence[str], None] = 'f54deaff5ae9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE certification_status RENAME VALUE 'planned' TO 'pending'")
    op.execute("ALTER TYPE certification_status RENAME VALUE 'done' TO 'completed'")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TYPE certification_status RENAME VALUE 'pending' TO 'planned'")
    op.execute("ALTER TYPE certification_status RENAME VALUE 'completed' TO 'done'")
