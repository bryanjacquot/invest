from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ==========================================
# Auth Schemas
# ==========================================
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str


class UserOut(BaseModel):
    id: str
    username: str
    created_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==========================================
# Target Config Schemas
# ==========================================
class TargetConfigBase(BaseModel):
    target_annual_return_rate: float = Field(..., ge=-100.0, le=500.0, description="Annual target return in percent, e.g. 7.5")
    notes: Optional[str] = None


class TargetConfigUpdate(BaseModel):
    target_annual_return_rate: float
    notes: Optional[str] = None


class TargetConfigOut(TargetConfigBase):
    account_id: str
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Manual Account & Loan Details
# ==========================================
class ManualDetailBase(BaseModel):
    description: Optional[str] = None
    property_address: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = None
    original_loan_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    monthly_payment: Optional[float] = None
    maturity_date: Optional[date] = None
    notes: Optional[str] = None


class ManualDetailOut(ManualDetailBase):
    account_id: str
    updated_at: datetime

    class Config:
        from_attributes = True


class ManualAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    account_class: str = Field("asset", description="'asset' or 'liability'")
    type: str = Field("real_estate", description="'real_estate', 'loan', 'investment', 'depository', 'other'")
    subtype: Optional[str] = Field("property", description="'property', 'mortgage', 'auto_loan', 'vehicle', 'savings', 'brokerage', etc.")
    category_group: str = Field("Real Estate", description="'Retirement', 'Taxable Brokerage', 'Emergency Savings', 'Real Estate', 'Debt', 'Other'")
    initial_balance: float = Field(0.0, description="Current market valuation or loan balance")
    currency: str = "USD"
    linked_asset_id: Optional[str] = None
    target_annual_return_rate: Optional[float] = 5.0
    manual_detail: Optional[ManualDetailBase] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    category_group: Optional[str] = None
    is_active: Optional[bool] = None
    linked_asset_id: Optional[str] = None
    target_annual_return_rate: Optional[float] = None


class ValuationLogCreate(BaseModel):
    account_id: str
    new_balance: float
    date: Optional[datetime] = None
    note: Optional[str] = None


# ==========================================
# Snapshots & Holdings
# ==========================================
class SnapshotOut(BaseModel):
    id: str
    account_id: str
    snapshot_timestamp: datetime
    current_balance: float
    available_balance: Optional[float] = None
    cost_basis_total: Optional[float] = None
    market_value_total: Optional[float] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True


class HoldingOut(BaseModel):
    id: str
    account_id: str
    account_name: Optional[str] = None
    ticker_symbol: Optional[str] = None
    name: str
    asset_type: str
    quantity: float
    institution_price: float
    institution_value: float
    cost_basis: Optional[float] = None
    unrealized_gain_loss: Optional[float] = None
    unrealized_gain_loss_pct: Optional[float] = None
    portfolio_weight_pct: Optional[float] = None
    risk_tier: str
    risk_score: float
    as_of_date: datetime

    class Config:
        from_attributes = True


# ==========================================
# Account Out
# ==========================================
class AccountOut(BaseModel):
    id: str
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None
    linked_asset_id: Optional[str] = None
    linked_asset_name: Optional[str] = None
    source_type: str
    account_class: str
    name: str
    official_name: Optional[str] = None
    mask: Optional[str] = None
    type: str
    subtype: Optional[str] = None
    category_group: str
    currency: str
    is_active: bool
    current_balance: float = 0.0
    target_annual_return_rate: Optional[float] = 7.0
    manual_detail: Optional[ManualDetailOut] = None
    created_at: datetime
    last_updated: Optional[datetime] = None

    class Config:
        from_attributes = True


class RealEstateEquityOut(BaseModel):
    property_account_id: str
    property_name: str
    property_address: Optional[str] = None
    market_value: float
    mortgage_account_id: Optional[str] = None
    mortgage_name: Optional[str] = None
    mortgage_balance: float
    equity_value: float
    equity_pct: float
    ltv_pct: float
    interest_rate: Optional[float] = None
    monthly_payment: Optional[float] = None


# ==========================================
# Performance & Analytics Schemas
# ==========================================
class TimeframePerformance(BaseModel):
    timeframe: str  # '1M', 'YTD', '1Y', '3Y', '5Y', 'Lifetime'
    start_date: str
    end_date: str
    start_balance: float
    end_balance: float
    net_contributions: float
    capital_gain_loss: float
    return_pct: float
    annualized_return_pct: Optional[float] = None
    target_return_pct: float
    target_end_balance: float
    variance_dollars: float
    variance_pct: float
    ahead_of_target: bool


class ChartPoint(BaseModel):
    date: str
    actual_balance: float
    actual_return_pct: float
    target_balance: float
    target_return_pct: float


class PerformanceResponse(BaseModel):
    account_filter: str
    timeframe: str
    timeframe_metrics: Dict[str, TimeframePerformance]
    chart_series: List[ChartPoint]
    account_breakdown: List[Dict[str, Any]]


class RiskProfileResponse(BaseModel):
    blended_risk_score: float  # 1.0 to 5.0
    blended_risk_tier: str  # 'Very Low', 'Low', 'Moderate', 'High', 'Very High'
    asset_allocation: List[Dict[str, Any]]  # category, value, pct, risk_score
    account_risks: List[Dict[str, Any]]  # account_id, account_name, risk_score, risk_tier, value


class NetWorthSummary(BaseModel):
    total_net_worth: float
    total_invested_assets: float
    total_retirement: float = 0.0
    total_taxable_brokerage: float = 0.0
    total_iras: float = 0.0
    total_real_estate_assets: float
    total_other_assets: float
    total_liabilities: float
    total_mortgages: float = 0.0
    total_emergency_savings: float
    change_1m_dollars: float
    change_1m_pct: float
    change_ytd_dollars: float
    change_ytd_pct: float
    change_1y_dollars: float
    change_1y_pct: float
    last_synced_at: Optional[datetime] = None


# ==========================================
# Plaid & Sync Schemas
# ==========================================
class PlaidLinkTokenResponse(BaseModel):
    link_token: str
    expiration: str


class PlaidExchangeTokenRequest(BaseModel):
    public_token: str
    institution_name: Optional[str] = "Connected Bank"


class SyncResponse(BaseModel):
    success: bool
    message: str
    synced_institutions_count: int
    synced_accounts_count: int
    created_snapshots_count: int
    synced_holdings_count: int
    timestamp: datetime
