import pytest
from app.plaid_service import (
    encrypt_token,
    decrypt_token,
    PlaidService,
    is_plaid_configured,
)
from app.models import Institution, Account


def test_token_encryption_decryption():
    raw_token = "access-sandbox-99887766-5544-3322-1100"
    encrypted = encrypt_token(raw_token)
    assert encrypted != raw_token
    decrypted = decrypt_token(encrypted)
    assert decrypted == raw_token

    # Test empty string
    assert encrypt_token("") == ""
    assert decrypt_token("") == ""


def test_risk_classification():
    service = PlaidService()
    assert service.classify_risk("cash")[0] == "Very Low"
    assert service.classify_risk("bond")[0] == "Low"
    assert service.classify_risk("real_estate")[0] == "Moderate"
    assert service.classify_risk("etf", "VOO")[0] == "Moderate"
    assert service.classify_risk("etf", "QQQ")[0] == "High"
    assert service.classify_risk("equity", "NVDA")[0] == "High"
    assert service.classify_risk("crypto")[0] == "Very High"


def test_plaid_link_token_and_exchange(client, auth_headers):
    # 1. Create Link Token
    res_link = client.post("/api/plaid/link-token", headers=auth_headers)
    assert res_link.status_code == 200
    link_data = res_link.json()
    assert "link_token" in link_data

    # 2. Exchange public token
    res_exch = client.post("/api/plaid/exchange-token", headers=auth_headers, json={
        "public_token": "public-sandbox-mock-123",
        "institution_name": "Schwab Brokerage"
    })
    assert res_exch.status_code == 200
    assert res_exch.json()["success"] is True

    # 3. Trigger on-demand sync
    res_sync = client.post("/api/plaid/sync", headers=auth_headers)
    assert res_sync.status_code == 200
    sync_data = res_sync.json()
    assert sync_data["success"] is True
    assert sync_data["synced_institutions_count"] >= 1
    assert sync_data["created_snapshots_count"] >= 1


def test_sync_no_institutions(client, auth_headers):
    res_sync = client.post("/api/plaid/sync", headers=auth_headers)
    assert res_sync.status_code == 200
    assert res_sync.json()["synced_institutions_count"] == 0


def test_plaid_status_endpoint(client, auth_headers):
    res = client.get("/api/plaid/status", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "configured" in data
    assert "env" in data
    assert isinstance(data["configured"], bool)


def test_sync_records_error_and_clears_on_subsequent_success(client, auth_headers, db_session):
    # 1. Connect institution
    res_exch = client.post(
        "/api/plaid/exchange-token",
        headers=auth_headers,
        json={"public_token": "public-sandbox-error-test", "institution_name": "Test Bank"}
    )
    assert res_exch.status_code == 200
    inst_id = res_exch.json()["institution_id"]

    inst = db_session.query(Institution).filter(Institution.id == inst_id).first()
    assert inst is not None
    assert inst.last_sync_at is not None
    assert inst.sync_error is None

    # Verify AccountOut includes last_synced_at and sync_error
    res_accs = client.get("/api/accounts", headers=auth_headers)
    assert res_accs.status_code == 200
    acc_data = next((a for a in res_accs.json() if a["institution_id"] == inst_id), None)
    assert acc_data is not None
    assert acc_data["last_synced_at"] is not None
    assert acc_data["sync_error"] is None

    # 2. Simulate sync error by manually setting error
    inst.sync_error = "ITEM_LOGIN_REQUIRED: user credentials changed"
    for a in inst.accounts:
        a.sync_error = "ITEM_LOGIN_REQUIRED: user credentials changed"
    db_session.commit()

    # Verify accounts endpoint reflects sync_error
    res_err = client.get("/api/accounts", headers=auth_headers)
    acc_err = next((a for a in res_err.json() if a["institution_id"] == inst_id), None)
    assert acc_err["sync_error"] == "ITEM_LOGIN_REQUIRED: user credentials changed"

    # 3. Trigger sync again (successful mock sync)
    res_sync = client.post("/api/plaid/sync", headers=auth_headers)
    assert res_sync.status_code == 200
    assert res_sync.json()["success"] is True

    # Verify error is cleared on institution and account
    db_session.refresh(inst)
    assert inst.sync_error is None
    for a in inst.accounts:
        db_session.refresh(a)
        assert a.sync_error is None

    res_cleared = client.get("/api/accounts", headers=auth_headers)
    acc_cleared = next((a for a in res_cleared.json() if a["institution_id"] == inst_id), None)
    assert acc_cleared["sync_error"] is None

