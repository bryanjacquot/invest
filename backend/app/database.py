import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Ensure data directory exists
if settings.DATABASE_URL.startswith("sqlite"):
    db_path = settings.DATABASE_URL.replace("sqlite:////", "/").replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

# Create engine with connect_args for SQLite WAL mode and foreign keys
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable SQLite foreign key support and Write-Ahead Logging (WAL) for concurrency."""
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()
    except Exception:
        pass


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI database session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all database tables and migrate legacy account types."""
    Base.metadata.create_all(bind=engine)

    # Normalize existing database records to standardized uppercase types and matching subtypes
    with engine.begin() as conn:
        try:
            # 1. TAX-DEFERRED
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-DEFERRED', subtype = '401(k)'
                WHERE subtype IN ('401k', '401(k)') OR (type = 'investment' AND (name LIKE '%401%' OR category_group = 'Retirement'));
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-DEFERRED', subtype = '403(b)'
                WHERE subtype IN ('403b', '403(b)') OR name LIKE '%403%';
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-DEFERRED', subtype = '457(b)'
                WHERE subtype IN ('457b', '457(b)') OR name LIKE '%457%';
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-DEFERRED', subtype = 'IRA'
                WHERE (subtype IN ('ira', 'traditional_ira', 'IRA') AND name NOT LIKE '%roth%')
                OR (type = 'investment' AND category_group = 'IRAs' AND name NOT LIKE '%roth%');
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-DEFERRED', subtype = 'Other PreTax'
                WHERE subtype IN ('pretax_other', 'Other PreTax');
            """))

            # 2. TAX-FREE
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-FREE', subtype = 'Roth IRA'
                WHERE subtype IN ('roth_ira', 'roth', 'Roth IRA') OR name LIKE '%roth ira%' OR (category_group = 'IRAs' AND name LIKE '%roth%');
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-FREE', subtype = 'Roth 401(k)'
                WHERE subtype IN ('roth_401k', 'Roth 401(k)') OR (name LIKE '%roth%' AND name LIKE '%401%');
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-FREE', subtype = 'Roth 403(b)'
                WHERE subtype IN ('roth_403b', 'Roth 403(b)') OR (name LIKE '%roth%' AND name LIKE '%403%');
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-FREE', subtype = 'Roth 457(b)'
                WHERE subtype IN ('roth_457b', 'Roth 457(b)');
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-FREE', subtype = '529'
                WHERE subtype = '529' OR name LIKE '%529%';
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAX-FREE', subtype = 'HSA'
                WHERE subtype IN ('hsa', 'HSA') OR name LIKE '%hsa%';
            """))

            # 3. REAL-ESTATE, OTHER
            conn.execute(text("""
                UPDATE accounts SET type = 'REAL-ESTATE, OTHER', subtype = 'Real Estate / Property'
                WHERE type IN ('real_estate', 'real estate', 'REAL ESTATE') OR subtype IN ('property', 'Real Estate / Property') OR category_group = 'Real Estate';
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'REAL-ESTATE, OTHER', subtype = 'Other Asset'
                WHERE (type = 'investment' AND subtype = 'other') OR subtype = 'Other Asset';
            """))

            # 4. DEBT
            conn.execute(text("""
                UPDATE accounts SET type = 'DEBT', subtype = 'Mortgage'
                WHERE (type IN ('loan', 'debt', 'DEBT') OR account_class = 'liability') AND (subtype IN ('mortgage', 'Mortgage') OR name LIKE '%mortgage%' OR name LIKE '%Mortgage%');
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'DEBT', subtype = 'Other'
                WHERE (type IN ('loan', 'debt', 'DEBT') OR account_class = 'liability') AND subtype != 'Mortgage';
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'DEBT'
                WHERE account_class = 'liability';
            """))

            # 5. TAXABLE
            conn.execute(text("""
                UPDATE accounts SET type = 'TAXABLE', subtype = 'Checking'
                WHERE subtype IN ('checking', 'Checking') OR name LIKE '%checking%' OR name LIKE '%Checking%';
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAXABLE', subtype = 'Savings'
                WHERE subtype IN ('savings', 'Savings') OR (type = 'depository' AND name LIKE '%savings%') OR name LIKE '%Savings%';
            """))
            conn.execute(text("""
                UPDATE accounts SET type = 'TAXABLE', subtype = 'Investment'
                WHERE (type IN ('investment', 'depository') OR subtype IN ('brokerage', 'Investment')) AND type NOT IN ('TAX-DEFERRED', 'TAX-FREE', 'REAL-ESTATE, OTHER', 'DEBT');
            """))
        except Exception as e:
            print(f"Schema normalization note: {e}")

