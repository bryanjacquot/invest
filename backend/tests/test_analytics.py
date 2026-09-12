import pytest
from app.seed import seed_demo_portfolio
from app.models import Account


def test_empty_analytics(client, auth_headers):
    # Test net worth with zero accounts
    res_nw = client.get("/api/analytics/net-worth", headers=auth_headers)
    assert res_nw.status_code == 200
    nw_data = res_nw.json()
    assert nw_data["total_net_worth"] == 0.0

    # Test performance with zero accounts
    res_perf = client.get("/api/analytics/performance", headers=auth_headers)
    assert res_perf.status_code == 200
    perf_data = res_perf.json()
    assert perf_data["chart_series"] == []
    assert perf_data["account_breakdown"] == []

    # Test risk profile with zero accounts
    res_risk = client.get("/api/analytics/risk-profile", headers=auth_headers)
    assert res_risk.status_code == 200
    risk_data = res_risk.json()
    assert risk_data["blended_risk_tier"] == "Moderate"

    # Test holdings with zero accounts
    res_hold = client.get("/api/analytics/holdings", headers=auth_headers)
    assert res_hold.status_code == 200
    assert res_hold.json() == []


def test_analytics_with_demo_portfolio(client, auth_headers, db_session, test_user):
    # Seed the realistic 5-year demo portfolio
    seed_demo_portfolio(db_session, test_user)

    # 1. Test Net Worth Summary
    res_nw = client.get("/api/analytics/net-worth", headers=auth_headers)
    assert res_nw.status_code == 200
    nw = res_nw.json()
    assert nw["total_net_worth"] > 0
    assert nw["total_invested_assets"] > 0
    assert nw["total_real_estate_assets"] > 0
    assert nw["total_emergency_savings"] > 0
    assert nw["total_liabilities"] > 0
    # Net worth must equal invested + real estate + other - liabilities
    expected_nw = round(nw["total_invested_assets"] + nw["total_real_estate_assets"] + nw["total_other_assets"] - nw["total_liabilities"], 2)
    assert abs(nw["total_net_worth"] - expected_nw) < 0.1

    # 2. Test Performance for all standard timeframes
    for tf in ["1M", "YTD", "1Y", "3Y", "5Y", "Lifetime"]:
        res_perf = client.get(f"/api/analytics/performance?timeframe={tf}&account_filter=all", headers=auth_headers)
        assert res_perf.status_code == 200
        pdata = res_perf.json()
        assert pdata["timeframe"] == tf
        assert tf in pdata["timeframe_metrics"]
        tf_metric = pdata["timeframe_metrics"][tf]
        assert "start_balance" in tf_metric
        assert "end_balance" in tf_metric
        assert "return_pct" in tf_metric
        assert "target_return_pct" in tf_metric
        assert "variance_dollars" in tf_metric
        assert len(pdata["chart_series"]) > 0
        assert len(pdata["account_breakdown"]) > 0

    # 3. Test Multi-Account Filter Options
    for filter_opt in ["all", "Retirement", "Taxable Brokerage", "Emergency Savings", "Real Estate"]:
        res_filter = client.get(f"/api/analytics/performance?timeframe=1Y&account_filter={filter_opt}", headers=auth_headers)
        assert res_filter.status_code == 200
        fdata = res_filter.json()
        assert fdata["account_filter"] == filter_opt
        assert len(fdata["chart_series"]) > 0

    # 4. Test Single Account ID Filter
    accounts = db_session.query(Account).filter(Account.user_id == test_user.id).all()
    first_acc = accounts[0]
    res_single = client.get(f"/api/analytics/performance?timeframe=1Y&account_filter={first_acc.id}", headers=auth_headers)
    assert res_single.status_code == 200
    sdata = res_single.json()
    assert len(sdata["account_breakdown"]) == 1
    assert sdata["account_breakdown"][0]["account_id"] == first_acc.id

    # 5. Test Holdings Breakdown
    res_holdings = client.get("/api/analytics/holdings?account_filter=all", headers=auth_headers)
    assert res_holdings.status_code == 200
    h_list = res_holdings.json()
    assert len(h_list) >= 7
    tickers = [h["ticker_symbol"] for h in h_list if h["ticker_symbol"]]
    assert "VOO" in tickers
    assert "QQQ" in tickers
    assert "VIIIX" in tickers
    for h in h_list:
        assert "portfolio_weight_pct" in h
        assert "risk_tier" in h
        assert "unrealized_gain_loss" in h

    # 6. Test 5-Tier Risk Profile
    res_risk = client.get("/api/analytics/risk-profile?account_filter=all", headers=auth_headers)
    assert res_risk.status_code == 200
    rdata = res_risk.json()
    assert 1.0 <= rdata["blended_risk_score"] <= 5.0
    assert rdata["blended_risk_tier"] in ["Very Low", "Low", "Moderate", "High", "Very High"]
    assert len(rdata["asset_allocation"]) >= 3
    assert len(rdata["account_risks"]) >= 3


def test_performance_isolates_contributions_from_gains(client, auth_headers, db_session, test_user):
    from datetime import datetime, timedelta
    from app.models import Account, AccountSnapshot

    # Create an account with a snapshot from 45 days ago
    acc = Account(
        user_id=test_user.id,
        source_type="manual",
        account_class="asset",
        name="Contributions Test Account",
        type="TAX-FREE",
        subtype="HSA",
        category_group="IRAs"
    )
    db_session.add(acc)
    db_session.commit()

    old_time = datetime.utcnow() - timedelta(days=45)
    s0 = AccountSnapshot(
        account_id=acc.id,
        snapshot_timestamp=old_time,
        current_balance=20000.0,
        net_contribution=0.0
    )
    db_session.add(s0)
    db_session.commit()

    # 1. Log a pure contribution of $2,000 (balance goes from 20k to 22k)
    res_val1 = client.post("/api/accounts/valuations", headers=auth_headers, json={
        "account_id": acc.id,
        "new_balance": 22000.0,
        "contribution": 2000.0,
        "note": "Pure cash deposit"
    })
    assert res_val1.status_code == 200

    # Fetch 1Y performance for this specific account
    perf1 = client.get(f"/api/analytics/performance?timeframe=1Y&account_filter={acc.id}", headers=auth_headers).json()
    m1 = perf1["timeframe_metrics"]["1Y"]
    assert m1["start_balance"] == 20000.0
    assert m1["end_balance"] == 22000.0
    assert m1["net_contributions"] == 2000.0
    assert m1["capital_gain_loss"] == 0.0
    assert m1["return_pct"] == 0.0

    # 2. Now log a valuation gain of $1,000 with $0 contribution (balance goes to 23k)
    res_val2 = client.post("/api/accounts/valuations", headers=auth_headers, json={
        "account_id": acc.id,
        "new_balance": 23000.0,
        "contribution": 0.0,
        "note": "Market appreciation"
    })
    assert res_val2.status_code == 200

    perf2 = client.get(f"/api/analytics/performance?timeframe=1Y&account_filter={acc.id}", headers=auth_headers).json()
    m2 = perf2["timeframe_metrics"]["1Y"]
    assert m2["start_balance"] == 20000.0
    assert m2["end_balance"] == 23000.0
    assert m2["net_contributions"] == 2000.0
    assert m2["capital_gain_loss"] == 1000.0
    assert m2["return_pct"] > 0.0

