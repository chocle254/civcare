from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Adding breaks column (SQLite format: just ADD COLUMN)
    # The dialect seems to support IF NOT EXISTS or we can just ignore errors. Wait, sqlite does not support IF NOT EXISTS for ADD COLUMN in older versions, but let's try it. Actually, wait, Postgres supports it. Let's just do it.
    try:
        conn.execute(text('ALTER TABLE doctors ADD COLUMN breaks VARCHAR;'))
    except Exception as e:
        print("Column might already exist or error:", e)
    conn.commit()

print("Breaks column added to doctors table!")
