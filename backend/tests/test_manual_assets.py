import pytest
from datetime import datetime, date


def test_create_real_estate_and_linked_mortgage(client, auth_headers):
    # 1. Create Real Estate property
    res_prop = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Boulder Mountain Home",
        "account_class": "asset",
        "type": "real_estate",
        "subtype": "property",
        "category_group": "Real Estate",
        "initial_balance": 750000.0,
        "target_annual_return_rate": 4.5,
        "manual_detail": {
            "description": "Primary single-family residence",
            "property_address": "456 Pine Ridge Way, Boulder, CO",
            "purchase_date": "2021-05-10",
            "purchase_price": 620000.0,
            "notes": "Renovated kitchen in 2023"
        }
    })
    assert res_prop.status_code == 201
    prop_data = res_prop.json()
    prop_id = prop_data["id"]
    assert prop_data["name"] == "Boulder Mountain Home"
    assert prop_data["manual_detail"]["property_address"] == "456 Pine Ridge Way, Boulder, CO"

    # 2. Create Mortgage linked to Property
    res_mort = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Boulder Home Mortgage",
        "account_class": "liability",
        "type": "loan",
        "subtype": "mortgage",
        "category_group": "Debt",
        "initial_balance": 450000.0,
        "linked_asset_id": prop_id,
        "target_annual_return_rate": 0.0,
        "manual_detail": {
            "original_loan_amount": 496000.0,
            "interest_rate": 3.25,
            "monthly_payment": 2150.0,
            "maturity_date": "2051-05-01"
        }
    })
    assert res_mort.status_code == 201
    mort_data = res_mort.json()
    mort_id = mort_data["id"]
    assert mort_data["linked_asset_id"] == prop_id

    # 3. Check Real Estate Equity summary
    res_equity = client.get("/api/accounts/real-estate-equity", headers=auth_headers)
    assert res_equity.status_code == 200
    equity_list = res_equity.json()
    assert len(equity_list) == 1
    eq = equity_list[0]
    assert eq["property_account_id"] == prop_id
    assert eq["property_name"] == "Boulder Mountain Home"
    assert eq["market_value"] == 750000.0
    assert eq["mortgage_account_id"] == mort_id
    assert eq["mortgage_balance"] == 450000.0
    assert eq["equity_value"] == 300000.0  # 750k - 450k
    assert eq["equity_pct"] == 40.0        # 300k / 750k * 100
    assert eq["ltv_pct"] == 60.0           # 450k / 750k * 100
    assert eq["interest_rate"] == 3.25

    # 4. Log appraisal / valuation update for property
    res_val = client.post("/api/accounts/valuations", headers=auth_headers, json={
        "account_id": prop_id,
        "new_balance": 800000.0,
        "note": "2026 Spring Appraisal"
    })
    assert res_val.status_code == 200
    assert res_val.json()["success"] is True

    # 5. Log paydown for mortgage
    res_pay = client.post("/api/accounts/valuations", headers=auth_headers, json={
        "account_id": mort_id,
        "new_balance": 440000.0,
        "note": "Principal extra payment"
    })
    assert res_pay.status_code == 200

    # 6. Re-check equity
    res_equity2 = client.get("/api/accounts/real-estate-equity", headers=auth_headers)
    assert res_equity2.status_code == 200
    eq2 = res_equity2.json()[0]
    assert eq2["market_value"] == 800000.0
    assert eq2["mortgage_balance"] == 440000.0
    assert eq2["equity_value"] == 360000.0  # 800k - 440k
    assert eq2["equity_pct"] == 45.0
    assert eq2["ltv_pct"] == 55.0


def test_create_manual_account_invalid_linked_asset(client, auth_headers):
    res = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Invalid Loan",
        "account_class": "liability",
        "type": "loan",
        "category_group": "Debt",
        "initial_balance": 10000.0,
        "linked_asset_id": "nonexistent-asset-id"
    })
    assert res.status_code == 400
    assert "Linked asset account not found" in res.json()["detail"]


def test_log_valuation_invalid_account(client, auth_headers):
    res = client.post("/api/accounts/valuations", headers=auth_headers, json={
        "account_id": "fake-account-id",
        "new_balance": 50000.0
    })
    assert res.status_code == 404
