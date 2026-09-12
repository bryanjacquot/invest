import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Float,
    Boolean,
    DateTime,
    Date,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    institutions = relationship("Institution", back_populates="user", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")


class Institution(Base):
    __tablename__ = "institutions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    plaid_item_id = Column(String(150), nullable=True, index=True)
    plaid_access_token_encrypted = Column(Text, nullable=True)
    is_manual = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_sync_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="institutions")
    accounts = relationship("Account", back_populates="institution", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    institution_id = Column(String(36), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=True, index=True)
    linked_asset_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    source_type = Column(String(20), default="manual", nullable=False)  # 'plaid' or 'manual'
    account_class = Column(String(20), default="asset", nullable=False)  # 'asset' or 'liability'
    plaid_account_id = Column(String(150), nullable=True, index=True)
    name = Column(String(150), nullable=False)
    official_name = Column(String(255), nullable=True)
    mask = Column(String(20), nullable=True)
    type = Column(String(50), default="investment", nullable=False)  # 'investment', 'real_estate', 'loan', 'depository', 'other'
    subtype = Column(String(50), nullable=True)  # 'brokerage', '401k', 'mortgage', 'auto_loan', 'property', 'savings', etc.
    category_group = Column(String(50), default="Other", nullable=False)  # 'Retirement', 'Taxable Brokerage', 'Emergency Savings', 'Real Estate', 'Debt', 'Other'
    currency = Column(String(10), default="USD", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="accounts")
    institution = relationship("Institution", back_populates="accounts")
    manual_detail = relationship("ManualAccountDetail", back_populates="account", uselist=False, cascade="all, delete-orphan")
    target_config = relationship("TargetConfig", back_populates="account", uselist=False, cascade="all, delete-orphan")
    snapshots = relationship("AccountSnapshot", back_populates="account", cascade="all, delete-orphan", order_by="AccountSnapshot.snapshot_timestamp.asc()")
    holdings = relationship("Holding", back_populates="account", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")

    # Relationships for loan to asset linking (post_update allows bidirectional links without circular flush dependency)
    linked_asset = relationship("Account", remote_side=[id], foreign_keys=[linked_asset_id], post_update=True, backref="linked_loans")


class ManualAccountDetail(Base):
    __tablename__ = "manual_account_details"

    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    description = Column(Text, nullable=True)
    property_address = Column(String(255), nullable=True)
    purchase_date = Column(Date, nullable=True)
    purchase_price = Column(Float, nullable=True)
    original_loan_amount = Column(Float, nullable=True)
    interest_rate = Column(Float, nullable=True)
    monthly_payment = Column(Float, nullable=True)
    maturity_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    account = relationship("Account", back_populates="manual_detail")


class TargetConfig(Base):
    __tablename__ = "target_configs"

    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    target_annual_return_rate = Column(Float, default=7.0, nullable=False)  # in percent, e.g. 7.5 for 7.5%
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    account = relationship("Account", back_populates="target_config")


class AccountSnapshot(Base):
    __tablename__ = "account_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    current_balance = Column(Float, default=0.0, nullable=False)
    net_contribution = Column(Float, default=0.0, nullable=False)
    available_balance = Column(Float, nullable=True)
    cost_basis_total = Column(Float, nullable=True)
    market_value_total = Column(Float, nullable=True)
    note = Column(String(255), nullable=True)

    account = relationship("Account", back_populates="snapshots")


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    plaid_security_id = Column(String(150), nullable=True)
    ticker_symbol = Column(String(50), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    asset_type = Column(String(50), default="equity", nullable=False)  # 'equity', 'etf', 'mutual_fund', 'fixed_income', 'real_estate', 'cash', 'crypto', 'other'
    quantity = Column(Float, default=1.0, nullable=False)
    institution_price = Column(Float, default=0.0, nullable=False)
    institution_value = Column(Float, default=0.0, nullable=False)
    cost_basis = Column(Float, nullable=True)
    risk_tier = Column(String(20), default="Moderate", nullable=False)  # 'Very Low', 'Low', 'Moderate', 'High', 'Very High'
    risk_score = Column(Float, default=3.0, nullable=False)  # 1.0 (Very Low) to 5.0 (Very High)
    as_of_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    account = relationship("Account", back_populates="holdings")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    plaid_transaction_id = Column(String(150), nullable=True, index=True)
    date = Column(Date, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)  # positive = outflow/spend, negative = inflow/deposit in Plaid standard
    transaction_type = Column(String(50), default="investment", nullable=False)  # 'buy', 'sell', 'dividend', 'deposit', 'withdrawal', 'fee', 'transfer'
    subcategory = Column(String(100), nullable=True)

    account = relationship("Account", back_populates="transactions")
