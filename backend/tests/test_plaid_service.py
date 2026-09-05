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
