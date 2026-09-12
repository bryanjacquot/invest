from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from app.models import (
    User,
    Institution,
    Account,
    ManualAccountDetail,
    TargetConfig,
    AccountSnapshot,
    Holding,
)
from app.plaid_service import encrypt_token


def seed_demo_portfolio(db: Session, user: User) -> dict:
    """Populate user profile with a realistic multi-asset investment portfolio and historical snapshots."""
    now = datetime.utcnow()

    # 1. Institutions
    inst_vanguard = Institution(
        user_id=user.id,
        name="Vanguard",
        plaid_access_token_encrypted=encrypt_token("access-mock-vanguard"),
        is_manual=False,
        created_at=now - timedelta(days=365 * 5),
        last_sync_at=now
    )
    inst_fidelity = Institution(
        user_id=user.id,
        name="Fidelity Investments",
        plaid_access_token_encrypted=encrypt_token("access-mock-fidelity"),
        is_manual=False,
        created_at=now - timedelta(days=365 * 5),
        last_sync_at=now
    )
    inst_schwab = Institution(
        user_id=user.id,
        name="Charles Schwab",
        plaid_access_token_encrypted=encrypt_token("access-mock-schwab"),
        is_manual=False,
        created_at=now - timedelta(days=365 * 5),
        last_sync_at=now
    )
    inst_manual = Institution(
        user_id=user.id,
        name="Manual & Real Estate Portfolio",
        is_manual=True,
        created_at=now - timedelta(days=365 * 5),
        last_sync_at=now
    )
    db.add_all([inst_vanguard, inst_fidelity, inst_schwab, inst_manual])
    db.commit()

    # 2. Accounts
    # 2a. Vanguard 401(k) Retirement
    acc_401k = Account(
        user_id=user.id,
        institution_id=inst_vanguard.id,
        source_type="plaid",
        account_class="asset",
        name="Vanguard 401(k) Plan",
        type="TAX-DEFERRED",
        subtype="401(k)",
        category_group="Retirement",
        currency="USD",
        is_active=True,
        created_at=now - timedelta(days=365 * 5)
    )
    # 2b. Fidelity Taxable Brokerage
    acc_brokerage = Account(
        user_id=user.id,
        institution_id=inst_fidelity.id,
        source_type="plaid",
        account_class="asset",
        name="Fidelity Taxable Brokerage",
        type="TAXABLE",
        subtype="Investment",
        category_group="Taxable Brokerage",
        currency="USD",
        is_active=True,
        created_at=now - timedelta(days=365 * 5)
    )
    # 2c. Schwab Roth IRA
    acc_ira = Account(
        user_id=user.id,
        institution_id=inst_schwab.id,
        source_type="plaid",
        account_class="asset",
        name="Schwab Roth IRA",
        type="TAX-FREE",
        subtype="Roth IRA",
        category_group="IRAs",
        currency="USD",
        is_active=True,
        created_at=now - timedelta(days=365 * 5)
    )
    # 2d. High Yield Emergency Savings
    acc_savings = Account(
        user_id=user.id,
        institution_id=inst_fidelity.id,
        source_type="plaid",
        account_class="asset",
        name="Ally High Yield Savings",
        type="TAXABLE",
        subtype="Savings",
        category_group="Emergency Savings",
        currency="USD",
        is_active=True,
        created_at=now - timedelta(days=365 * 5)
    )
    # 2e. Primary Residence Real Estate
    acc_property = Account(
        user_id=user.id,
        institution_id=inst_manual.id,
        source_type="manual",
        account_class="asset",
        name="Primary Residence (123 Maple St)",
        type="REAL-ESTATE, OTHER",
        subtype="Real Estate / Property",
        category_group="Real Estate",
        currency="USD",
        is_active=True,
        created_at=now - timedelta(days=365 * 5)
    )

    db.add_all([acc_401k, acc_brokerage, acc_ira, acc_savings, acc_property])
    db.commit()

    # 2f. Primary Residence Mortgage linked to Property
    acc_mortgage = Account(
        user_id=user.id,
        institution_id=inst_manual.id,
        linked_asset_id=acc_property.id,
        source_type="manual",
        account_class="liability",
        name="30-Year Fixed Home Mortgage",
        type="DEBT",
        subtype="Mortgage",
        category_group="Debt",
        currency="USD",
        is_active=True,
        created_at=now - timedelta(days=365 * 5)
    )
    db.add(acc_mortgage)
    db.commit()

    # 3. Target Configurations
    targets = [
        TargetConfig(account_id=acc_401k.id, target_annual_return_rate=8.5, notes="Retirement growth target"),
        TargetConfig(account_id=acc_brokerage.id, target_annual_return_rate=9.0, notes="Taxable equity growth"),
        TargetConfig(account_id=acc_ira.id, target_annual_return_rate=8.0, notes="Roth IRA growth target"),
        TargetConfig(account_id=acc_savings.id, target_annual_return_rate=4.5, notes="HYSA interest rate"),
        TargetConfig(account_id=acc_property.id, target_annual_return_rate=4.0, notes="Real estate appreciation target"),
        TargetConfig(account_id=acc_mortgage.id, target_annual_return_rate=0.0, notes="Debt amortization")
    ]
    db.add_all(targets)

    # 4. Manual Details for Property & Mortgage
    prop_detail = ManualAccountDetail(
        account_id=acc_property.id,
        property_address="123 Maple Street, Boulder, CO 80302",
        purchase_date=date(now.year - 5, 6, 15),
        purchase_price=580000.0,
        notes="Single-family home 4 bed, 3 bath"
    )
    mortgage_detail = ManualAccountDetail(
        account_id=acc_mortgage.id,
        original_loan_amount=464000.0,
        interest_rate=3.75,
        monthly_payment=2148.0,
        maturity_date=date(now.year + 25, 6, 15),
        notes="Fixed rate 30-year conventional mortgage"
    )
    db.add_all([prop_detail, mortgage_detail])
    db.commit()

    # 5. Generate Multi-Year Historical Snapshots (Every 30 days for 5 years = 60 points)
    snapshots = []
    num_months = 60

    # Base initial values 5 years ago
    v_401k_base = 120000.0
    v_brokerage_base = 65000.0
    v_ira_base = 42000.0
    v_savings_base = 25000.0
    v_prop_base = 580000.0
    v_mort_base = 464000.0

    for i in range(num_months + 1):
        snap_time = now - timedelta(days=(num_months - i) * 30.5)
        progress = i / num_months

        # Realistic compound growth paths
        val_401k = round(v_401k_base * (1.0 + 0.088) ** (progress * 5.0), 2)
        val_brokerage = round(v_brokerage_base * (1.0 + 0.098) ** (progress * 5.0), 2)
        val_ira = round(v_ira_base * (1.0 + 0.085) ** (progress * 5.0), 2)
        val_savings = round(v_savings_base * (1.0 + 0.042) ** (progress * 5.0), 2)
        val_prop = round(v_prop_base * (1.0 + 0.046) ** (progress * 5.0), 2)
        val_mort = round(max(0.0, v_mort_base - (progress * 55000.0)), 2)

        snapshots.extend([
            AccountSnapshot(account_id=acc_401k.id, snapshot_timestamp=snap_time, current_balance=val_401k, market_value_total=val_401k),
            AccountSnapshot(account_id=acc_brokerage.id, snapshot_timestamp=snap_time, current_balance=val_brokerage, market_value_total=val_brokerage),
            AccountSnapshot(account_id=acc_ira.id, snapshot_timestamp=snap_time, current_balance=val_ira, market_value_total=val_ira),
            AccountSnapshot(account_id=acc_savings.id, snapshot_timestamp=snap_time, current_balance=val_savings, market_value_total=val_savings),
            AccountSnapshot(account_id=acc_property.id, snapshot_timestamp=snap_time, current_balance=val_prop, market_value_total=val_prop),
            AccountSnapshot(account_id=acc_mortgage.id, snapshot_timestamp=snap_time, current_balance=val_mort, market_value_total=val_mort)
        ])

    db.add_all(snapshots)
    db.commit()

    # 6. Granular Holdings for Accounts
    # 401(k) Holdings
    h_401k_1 = Holding(
        account_id=acc_401k.id,
        ticker_symbol="VIIIX",
        name="Vanguard Institutional Index Fund (S&P 500)",
        asset_type="mutual_fund",
        quantity=310.0,
        institution_price=420.0,
        institution_value=130200.0,
        cost_basis=92000.0,
        risk_tier="Moderate",
        risk_score=3.2,
        as_of_date=now
    )
    h_401k_2 = Holding(
        account_id=acc_401k.id,
        ticker_symbol="VBTLX",
        name="Vanguard Total Bond Market Index",
        asset_type="fixed_income",
        quantity=5350.0,
        institution_price=9.80,
        institution_value=52430.0,
        cost_basis=54000.0,
        risk_tier="Low",
        risk_score=1.8,
        as_of_date=now
    )

    # Taxable Brokerage Holdings
    h_brok_1 = Holding(
        account_id=acc_brokerage.id,
        ticker_symbol="VOO",
        name="Vanguard S&P 500 ETF",
        asset_type="etf",
        quantity=95.0,
        institution_price=510.0,
        institution_value=48450.0,
        cost_basis=34000.0,
        risk_tier="Moderate",
        risk_score=3.2,
        as_of_date=now
    )
    h_brok_2 = Holding(
        account_id=acc_brokerage.id,
        ticker_symbol="QQQ",
        name="Invesco QQQ Trust (Nasdaq 100)",
        asset_type="etf",
        quantity=62.0,
        institution_price=480.0,
        institution_value=29760.0,
        cost_basis=18500.0,
        risk_tier="High",
        risk_score=4.2,
        as_of_date=now
    )
    h_brok_3 = Holding(
        account_id=acc_brokerage.id,
        ticker_symbol="NVDA",
        name="NVIDIA Corporation",
        asset_type="equity",
        quantity=140.0,
        institution_price=120.0,
        institution_value=16800.0,
        cost_basis=6500.0,
        risk_tier="High",
        risk_score=4.6,
        as_of_date=now
    )
    h_brok_4 = Holding(
        account_id=acc_brokerage.id,
        ticker_symbol="AAPL",
        name="Apple Inc.",
        asset_type="equity",
        quantity=45.0,
        institution_price=220.0,
        institution_value=9900.0,
        cost_basis=6200.0,
        risk_tier="Moderate",
        risk_score=3.5,
        as_of_date=now
    )

    # Roth IRA Holdings
    h_ira_1 = Holding(
        account_id=acc_ira.id,
        ticker_symbol="SCHD",
        name="Schwab U.S. Dividend Equity ETF",
        asset_type="etf",
        quantity=380.0,
        institution_price=82.50,
        institution_value=31350.0,
        cost_basis=24500.0,
        risk_tier="Moderate",
        risk_score=2.8,
        as_of_date=now
    )
    h_ira_2 = Holding(
        account_id=acc_ira.id,
        ticker_symbol="VXUS",
        name="Vanguard Total International Stock ETF",
        asset_type="etf",
        quantity=520.0,
        institution_price=62.0,
        institution_value=32240.0,
        cost_basis=27000.0,
        risk_tier="Moderate",
        risk_score=3.4,
        as_of_date=now
    )

    # Savings Holding
    h_sav = Holding(
        account_id=acc_savings.id,
        ticker_symbol="CASH",
        name="US Dollar Liquid Savings",
        asset_type="cash",
        quantity=1.0,
        institution_price=val_savings,
        institution_value=val_savings,
        cost_basis=val_savings,
        risk_tier="Very Low",
        risk_score=1.0,
        as_of_date=now
    )

    # Real Estate Holding
    h_prop = Holding(
        account_id=acc_property.id,
        ticker_symbol="PROP",
        name="123 Maple Street Primary Residence",
        asset_type="real_estate",
        quantity=1.0,
        institution_price=val_prop,
        institution_value=val_prop,
        cost_basis=580000.0,
        risk_tier="Moderate",
        risk_score=3.0,
        as_of_date=now
    )

    db.add_all([h_401k_1, h_401k_2, h_brok_1, h_brok_2, h_brok_3, h_brok_4, h_ira_1, h_ira_2, h_sav, h_prop])
    db.commit()

    return {
        "user_id": user.id,
        "institutions_created": 4,
        "accounts_created": 6,
        "snapshots_created": len(snapshots),
        "holdings_created": 10
    }
