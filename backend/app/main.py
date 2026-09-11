import os
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import init_db, get_db
from app.models import User, Institution, Account, AccountSnapshot, Holding, TargetConfig
from app.schemas import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserOut,
    AccountOut,
    AccountUpdate,
    ManualAccountCreate,
    ValuationLogCreate,
    RealEstateEquityOut,
    NetWorthSummary,
    PerformanceResponse,
    HoldingOut,
    RiskProfileResponse,
    PlaidLinkTokenResponse,
    PlaidExchangeTokenRequest,
    PlaidStatusResponse,
    SyncResponse,
)
from app.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
)
from app.plaid_service import plaid_service, is_plaid_configured
from app.manual_asset_service import manual_asset_service
from app.analytics import analytics_engine
from app.backup import backup_service
from app.seed import seed_demo_portfolio

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

# Enable CORS for local web station / frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "timestamp": datetime.utcnow().isoformat()
    }


# =========================================================================
# Authentication Routes
# =========================================================================
@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """Create a new user account with salted password hashing."""
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )

    user = User(
        username=data.username,
        password_hash=get_password_hash(data.password),
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id, "username": user.username})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        username=user.username
    )


@app.post("/api/auth/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """Authenticate existing user and return signed JWT."""
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": user.id, "username": user.username})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        username=user.username
    )


@app.get("/api/auth/me", response_model=UserOut)
def get_current_user_profile(user: User = Depends(get_current_user)):
    """Get profile of authenticated user."""
    return user


# =========================================================================
# Account & Manual Asset Management
# =========================================================================
@app.get("/api/accounts", response_model=List[AccountOut])
def list_accounts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all user accounts with latest balances, targets, and linked assets."""
    accounts = db.query(Account).filter(Account.user_id == user.id).all()
    results = []
    
    for acc in accounts:
        # Latest snapshot balance
        last_snap = db.query(AccountSnapshot).filter(
            AccountSnapshot.account_id == acc.id
        ).order_by(AccountSnapshot.snapshot_timestamp.desc()).first()

        curr_bal = last_snap.current_balance if last_snap else 0.0
        last_up = last_snap.snapshot_timestamp if last_snap else acc.created_at

        target_rate = acc.target_config.target_annual_return_rate if acc.target_config else 7.0
        inst_name = acc.institution.name if acc.institution else "Manual"
        linked_name = acc.linked_asset.name if acc.linked_asset else None

        results.append(AccountOut(
            id=acc.id,
            institution_id=acc.institution_id,
            institution_name=inst_name,
            linked_asset_id=acc.linked_asset_id,
            linked_asset_name=linked_name,
            source_type=acc.source_type,
            account_class=acc.account_class,
            name=acc.name,
            official_name=acc.official_name,
            mask=acc.mask,
            type=acc.type,
            subtype=acc.subtype,
            category_group=acc.category_group,
            currency=acc.currency,
            is_active=acc.is_active,
            current_balance=curr_bal,
            target_annual_return_rate=target_rate,
            manual_detail=acc.manual_detail,
            created_at=acc.created_at,
            last_updated=last_up
        ))
    return results


@app.post("/api/accounts/manual", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_manual_account(
    data: ManualAccountCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new manual asset or loan account."""
    acc = manual_asset_service.create_manual_account(db, user, data)
    return AccountOut(
        id=acc.id,
        institution_id=acc.institution_id,
        institution_name=acc.institution.name if acc.institution else "Manual",
        linked_asset_id=acc.linked_asset_id,
        linked_asset_name=acc.linked_asset.name if acc.linked_asset else None,
        source_type=acc.source_type,
        account_class=acc.account_class,
        name=acc.name,
        official_name=acc.official_name,
        mask=acc.mask,
        type=acc.type,
        subtype=acc.subtype,
        category_group=acc.category_group,
        currency=acc.currency,
        is_active=acc.is_active,
        current_balance=data.initial_balance,
        target_annual_return_rate=acc.target_config.target_annual_return_rate if acc.target_config else 5.0,
        manual_detail=acc.manual_detail,
        created_at=acc.created_at,
        last_updated=acc.created_at
    )


@app.put("/api/accounts/{account_id}", response_model=AccountOut)
def update_account(
    account_id: str,
    data: AccountUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update account attributes (category group, name, target rate, active status, linked asset)."""
    acc = manual_asset_service.update_account(db, user, account_id, data)
    last_snap = db.query(AccountSnapshot).filter(
        AccountSnapshot.account_id == acc.id
    ).order_by(AccountSnapshot.snapshot_timestamp.desc()).first()

    return AccountOut(
        id=acc.id,
        institution_id=acc.institution_id,
        institution_name=acc.institution.name if acc.institution else "Manual",
        linked_asset_id=acc.linked_asset_id,
        linked_asset_name=acc.linked_asset.name if acc.linked_asset else None,
        source_type=acc.source_type,
        account_class=acc.account_class,
        name=acc.name,
        official_name=acc.official_name,
        mask=acc.mask,
        type=acc.type,
        subtype=acc.subtype,
        category_group=acc.category_group,
        currency=acc.currency,
        is_active=acc.is_active,
        current_balance=last_snap.current_balance if last_snap else 0.0,
        target_annual_return_rate=acc.target_config.target_annual_return_rate if acc.target_config else 7.0,
        manual_detail=acc.manual_detail,
        created_at=acc.created_at,
        last_updated=last_snap.snapshot_timestamp if last_snap else acc.created_at
    )


@app.post("/api/accounts/valuations")
def log_valuation(
    data: ValuationLogCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log a manual appraisal or loan balance update."""
    snap = manual_asset_service.log_valuation(db, user, data)
    return {
        "success": True,
        "message": "Valuation successfully logged",
        "snapshot_id": snap.id,
        "new_balance": snap.current_balance,
        "timestamp": snap.snapshot_timestamp.isoformat()
    }


@app.get("/api/accounts/real-estate-equity", response_model=List[RealEstateEquityOut])
def get_real_estate_equity(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get real estate properties with linked mortgage balances, equity, and LTV."""
    return manual_asset_service.get_real_estate_equity_summary(db, user)


# =========================================================================
# Analytics & Performance Engine Routes
# =========================================================================
@app.get("/api/analytics/net-worth", response_model=NetWorthSummary)
def get_net_worth(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch current aggregate net worth, category sums, and trailing gains."""
    return analytics_engine.get_net_worth_summary(db, user)


@app.get("/api/analytics/performance", response_model=PerformanceResponse)
def get_performance(
    account_filter: str = Query("all", description="'all', category group name, or account_id"),
    timeframe: str = Query("1Y", description="'1M', 'YTD', '1Y', '3Y', '5Y', 'Lifetime'"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Compute performance metrics, actual vs target curves, and tabular breakdowns."""
    return analytics_engine.get_performance(db, user, account_filter, timeframe)


@app.get("/api/analytics/holdings", response_model=List[HoldingOut])
def get_holdings(
    account_filter: str = Query("all", description="'all', category group name, or account_id"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch granular ticker/product breakdown for filtered accounts."""
    return analytics_engine.get_all_holdings(db, user, account_filter)


@app.get("/api/analytics/risk-profile", response_model=RiskProfileResponse)
def get_risk_profile(
    account_filter: str = Query("all", description="'all', category group name, or account_id"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch 5-tier risk scores and asset allocation distribution."""
    return analytics_engine.get_risk_profile(db, user, account_filter)


# =========================================================================
# Plaid Integration & On-Demand Sync
# =========================================================================
@app.get("/api/plaid/status", response_model=PlaidStatusResponse)
def get_plaid_status(user: User = Depends(get_current_user)):
    """Return whether Plaid API keys are configured via environment variables and the current environment."""
    return PlaidStatusResponse(
        configured=is_plaid_configured(),
        env=plaid_service.env
    )


@app.post("/api/plaid/link-token", response_model=PlaidLinkTokenResponse)
@app.post("/api/plaid/link/token", response_model=PlaidLinkTokenResponse)
def create_link_token(user: User = Depends(get_current_user)):
    """Create Plaid Link Token for frontend brokerage connection."""
    configured = is_plaid_configured()
    try:
        res = plaid_service.create_link_token(user.id, user.username)
        res["is_configured"] = configured
        return PlaidLinkTokenResponse(**res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Plaid Link error: {str(e)}")


@app.post("/api/plaid/exchange-token")
@app.post("/api/plaid/link/exchange")
def exchange_public_token(
    data: PlaidExchangeTokenRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exchange public token for permanent connection and sync accounts."""
    inst = plaid_service.exchange_public_token(db, user, data.public_token, data.institution_name or "Connected Brokerage")
    return {
        "success": True,
        "institution_id": inst.id,
        "institution_name": inst.name
    }


@app.post("/api/plaid/sync", response_model=SyncResponse)
def trigger_sync(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Trigger on-demand sync for all user institutions."""
    institutions = db.query(Institution).filter(Institution.user_id == user.id).all()
    if not institutions:
        return SyncResponse(
            success=True,
            message="No connected institutions to sync.",
            synced_institutions_count=0,
            synced_accounts_count=0,
            created_snapshots_count=0,
            synced_holdings_count=0,
            timestamp=datetime.utcnow()
        )

    total_accs = 0
    total_snaps = 0
    total_holds = 0

    for inst in institutions:
        stats = plaid_service.sync_institution(db, user, inst)
        total_accs += stats.get("synced_accounts", 0)
        total_snaps += stats.get("created_snapshots", 0)
        total_holds += stats.get("synced_holdings", 0)

    return SyncResponse(
        success=True,
        message="On-demand synchronization complete.",
        synced_institutions_count=len(institutions),
        synced_accounts_count=total_accs,
        created_snapshots_count=total_snaps,
        synced_holdings_count=total_holds,
        timestamp=datetime.utcnow()
    )


# =========================================================================
# Demo Seeding Route
# =========================================================================
@app.post("/api/seed/demo-portfolio")
def seed_demo_data(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Seed user profile with multi-asset demo portfolio & 5-year historical data for testing."""
    result = seed_demo_portfolio(db, user)
    return {
        "success": True,
        "message": "Demo portfolio with 5-year historical performance seeded successfully.",
        "details": result
    }


# =========================================================================
# Database Backup & Restore
# =========================================================================
@app.get("/api/backup/download")
def download_backup(user: User = Depends(get_current_user)):
    """Create a consistent SQLite snapshot and stream download."""
    backup_file = backup_service.create_local_backup()
    filename = os.path.basename(backup_file)
    return FileResponse(
        path=backup_file,
        filename=filename,
        media_type="application/x-sqlite3"
    )


@app.get("/api/backup/list")
def list_backups(user: User = Depends(get_current_user)):
    """List available local database backups."""
    return backup_service.list_backups()


@app.post("/api/backup/restore")
def restore_backup(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """Upload and restore database from a .sqlite backup file."""
    return backup_service.restore_backup(file)
