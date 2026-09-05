import pytest
from app.models import Account, TargetConfig, AccountSnapshot


def test_list_accounts_empty(client, auth_headers):
    res = client.get("/api/accounts", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_create_and_list_manual_accounts(client, auth_headers):
    # Create emergency savings account
    res_sav = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "High Yield Emergency Reserve",
        "account_class": "asset",
        "type": "depository",
        "subtype": "savings",
        "category_group": "Emergency Savings",
        "initial_balance": 35000.0,
        "target_annual_return_rate": 4.5
    })
    assert res_sav.status_code == 201
    sav_data = res_sav.json()
    assert sav_data["name"] == "High Yield Emergency Reserve"
    assert sav_data["category_group"] == "Emergency Savings"
    assert sav_data["current_balance"] == 35000.0
    assert sav_data["target_annual_return_rate"] == 4.5

    # Create retirement account
    res_ret = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Roth IRA Portfolio",
        "account_class": "asset",
        "type": "investment",
        "subtype": "ira",
        "category_group": "Retirement",
        "initial_balance": 85000.0,
        "target_annual_return_rate": 8.0
    })
    assert res_ret.status_code == 201

    # List accounts
    res_list = client.get("/api/accounts", headers=auth_headers)
    assert res_list.status_code == 200
    accounts = res_list.json()
    assert len(accounts) == 2
    names = [a["name"] for a in accounts]
    assert "High Yield Emergency Reserve" in names
    assert "Roth IRA Portfolio" in names


def test_update_account(client, auth_headers):
    res_create = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Custom Account",
        "account_class": "asset",
        "type": "investment",
        "category_group": "Other",
        "initial_balance": 10000.0
    })
    acc_id = res_create.json()["id"]

    # Re-categorize to Emergency Savings and change target return
    res_update = client.put(f"/api/accounts/{acc_id}", headers=auth_headers, json={
        "name": "Updated Emergency Fund",
        "category_group": "Emergency Savings",
        "target_annual_return_rate": 5.0,
        "is_active": True
    })
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["name"] == "Updated Emergency Fund"
    assert updated["category_group"] == "Emergency Savings"
    assert updated["target_annual_return_rate"] == 5.0


def test_update_nonexistent_account(client, auth_headers):
    res = client.put("/api/accounts/fake-id-1234", headers=auth_headers, json={
        "name": "New Name"
    })
    assert res.status_code == 404
