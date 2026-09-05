import pytest
from datetime import datetime, timedelta
from app.models import Account, TargetConfig, AccountSnapshot, Holding, User, Institution
from app.schemas import AccountUpdate, ManualAccountCreate
from app.manual_asset_service import manual_asset_service
from app.analytics import analytics_engine
from app.plaid_service import plaid_service, encrypt_token, decrypt_token


def test_auth_expired_or_invalid_token(client):
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.real.jwt"})
    assert res.status_code == 401


def test_update_account_branches(db_session, test_user):
    # Create manual account without target config
    acc = Account(
        user_id=test_user.id,
        source_type="manual",
        account_class="asset",
        name="Raw Account",
        type="investment",
        category_group="Taxable Brokerage",
        is_active=True
    )
    db_session.add(acc)
    db_session.commit()
    db_session.refresh(acc)

    # 1. Update target rate when none exists initially
    updated = manual_asset_service.update_account(
        db_session, test_user, acc.id,
        AccountUpdate(target_annual_return_rate=6.5, is_active=False)
    )
    assert updated.target_config.target_annual_return_rate == 6.5
    assert updated.is_active is False

    # 2. Clear linked asset
    cleared = manual_asset_service.update_account(
        db_session, test_user, acc.id,
        AccountUpdate(linked_asset_id="")
    )
    assert cleared.linked_asset_id is None


def test_analytics_edge_cases(db_session, test_user):
    # Test timeframe start dates
    now = datetime.utcnow()
    assert analytics_engine.get_timeframe_start_date("1M") < now
    assert analytics_engine.get_timeframe_start_date("YTD").month == 1
    assert analytics_engine.get_timeframe_start_date("1Y") < now
    assert analytics_engine.get_timeframe_start_date("3Y") < now
    assert analytics_engine.get_timeframe_start_date("5Y") < now
    first_d = now - timedelta(days=500)
    assert analytics_engine.get_timeframe_start_date("LIFETIME", first_d) == first_d
    assert analytics_engine.get_timeframe_start_date("UNKNOWN") < now

    # Test score to tier mapping
    assert analytics_engine._score_to_tier(1.2) == "Very Low"
    assert analytics_engine._score_to_tier(2.1) == "Low"
    assert analytics_engine._score_to_tier(3.0) == "Moderate"
    assert analytics_engine._score_to_tier(4.0) == "High"
    assert analytics_engine._score_to_tier(4.8) == "Very High"


def test_plaid_risk_classifier_full():
    assert plaid_service.classify_risk("depository")[0] == "Very Low"
    assert plaid_service.classify_risk("money_market")[0] == "Very Low"
    assert plaid_service.classify_risk("treasury")[0] == "Low"
    assert plaid_service.classify_risk("reit")[0] == "Moderate"
    assert plaid_service.classify_risk("index")[0] == "Moderate"
    assert plaid_service.classify_risk("etf", "ARKK")[0] == "High"
    assert plaid_service.classify_risk("stock", "TSLA")[0] == "High"
    assert plaid_service.classify_risk("option")[0] == "Very High"
    assert plaid_service.classify_risk("unknown_type")[0] == "Moderate"


def test_health_check_endpoint(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
