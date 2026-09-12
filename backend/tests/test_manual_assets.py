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
    assert "Linked account not found" in res.json()["detail"]


def test_log_valuation_invalid_account(client, auth_headers):
    res = client.post("/api/accounts/valuations", headers=auth_headers, json={
        "account_id": "fake-account-id",
        "new_balance": 50000.0
    })
    assert res.status_code == 404


def test_log_valuation_plaid_account_rejected(client, auth_headers, db_session, test_user):
    from app.models import Account, Institution
    # Insert a Plaid account directly
    inst = Institution(
        user_id=test_user.id,
        name="Chase Plaid",
        is_manual=False
    )
    db_session.add(inst)
    db_session.commit()

    plaid_acc = Account(
        user_id=test_user.id,
        institution_id=inst.id,
        source_type="plaid",
        account_class="asset",
        name="Chase Plaid Checking",
        type="checking",
        category_group="Emergency Savings"
    )
    db_session.add(plaid_acc)
    db_session.commit()

    # Attempt to log valuation for Plaid account
    res = client.post("/api/accounts/valuations", headers=auth_headers, json={
        "account_id": plaid_acc.id,
        "new_balance": 25000.0
    })
    assert res.status_code == 400
    assert "Valuation updates can only be logged for manually added accounts" in res.json()["detail"]


def test_bidirectional_account_linking(client, auth_headers):
    # 1. Create a Debt Account first
    res_debt = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Tesla Auto Loan",
        "account_class": "liability",
        "type": "loan",
        "category_group": "Debt",
        "initial_balance": 35000.0
    })
    assert res_debt.status_code == 201
    debt_id = res_debt.json()["id"]

    # 2. Create Asset Account linking to the Debt Account
    res_asset = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Tesla Model Y",
        "account_class": "asset",
        "type": "investment",
        "subtype": "other",
        "category_group": "Other",
        "initial_balance": 50000.0,
        "linked_asset_id": debt_id
    })
    assert res_asset.status_code == 201
    asset_id = res_asset.json()["id"]
    assert res_asset.json()["linked_asset_id"] == debt_id

    # 3. Verify Debt Account is now linked back to Asset Account
    res_accounts = client.get("/api/accounts", headers=auth_headers)
    assert res_accounts.status_code == 200
    accounts_map = {a["id"]: a for a in res_accounts.json()}
    assert accounts_map[debt_id]["linked_asset_id"] == asset_id
    assert accounts_map[asset_id]["linked_asset_id"] == debt_id

    # 4. Unlink via PUT update
    res_update = client.put(f"/api/accounts/{asset_id}", headers=auth_headers, json={
        "linked_asset_id": ""
    })
    assert res_update.status_code == 200
    assert res_update.json()["linked_asset_id"] is None

    # Verify both are now unlinked
    res_accounts2 = client.get("/api/accounts", headers=auth_headers)
    accounts_map2 = {a["id"]: a for a in res_accounts2.json()}
    assert accounts_map2[debt_id]["linked_asset_id"] is None
    assert accounts_map2[asset_id]["linked_asset_id"] is None


def test_standardized_account_types_and_subtypes(client, auth_headers):
    # Test TAXABLE type with Checking subtype
    res1 = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "My Checking",
        "account_class": "asset",
        "type": "TAXABLE",
        "subtype": "Checking",
        "category_group": "Emergency Savings",
        "initial_balance": 5000.0
    })
    assert res1.status_code == 201
    assert res1.json()["type"] == "TAXABLE"
    assert res1.json()["subtype"] == "Checking"

    # Test TAX-DEFERRED type with 401(k) subtype
    res2 = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "My 401k",
        "account_class": "asset",
        "type": "TAX-DEFERRED",
        "subtype": "401(k)",
        "category_group": "Retirement",
        "initial_balance": 150000.0
    })
    assert res2.status_code == 201
    assert res2.json()["type"] == "TAX-DEFERRED"
    assert res2.json()["subtype"] == "401(k)"

    # Test TAX-FREE type with Roth IRA subtype
    res3 = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "My Roth IRA",
        "account_class": "asset",
        "type": "TAX-FREE",
        "subtype": "Roth IRA",
        "category_group": "IRAs",
        "initial_balance": 40000.0
    })
    assert res3.status_code == 201
    assert res3.json()["type"] == "TAX-FREE"
    assert res3.json()["subtype"] == "Roth IRA"

    # Test REAL-ESTATE, OTHER type with Real Estate / Property subtype
    res4 = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Vacation Cabin",
        "account_class": "asset",
        "type": "REAL-ESTATE, OTHER",
        "subtype": "Real Estate / Property",
        "category_group": "Real Estate",
        "initial_balance": 350000.0
    })
    assert res4.status_code == 201
    assert res4.json()["type"] == "REAL-ESTATE, OTHER"
    assert res4.json()["subtype"] == "Real Estate / Property"

    # Test DEBT type with Mortgage subtype
    res5 = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Cabin Mortgage",
        "account_class": "liability",
        "type": "DEBT",
        "subtype": "Mortgage",
        "category_group": "Debt",
        "initial_balance": 200000.0,
        "linked_asset_id": res4.json()["id"]
    })
    assert res5.status_code == 201
    assert res5.json()["type"] == "DEBT"
    assert res5.json()["subtype"] == "Mortgage"

    # Test DEBT type with Other subtype
    res6 = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Personal Loan",
        "account_class": "liability",
        "type": "DEBT",
        "subtype": "Other",
        "category_group": "Debt",
        "initial_balance": 15000.0
    })
    assert res6.status_code == 201
    assert res6.json()["type"] == "DEBT"
    assert res6.json()["subtype"] == "Other"


def test_log_valuation_with_contribution(client, auth_headers):
    # 1. Create manual investment account
    res = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "HSA Health Equity",
        "account_class": "asset",
        "type": "TAX-FREE",
        "subtype": "HSA",
        "category_group": "IRAs",
        "initial_balance": 20000.0
    })
    assert res.status_code == 201
    acc_id = res.json()["id"]

    # 2. Log valuation update with a contribution
    val_res = client.post("/api/accounts/valuations", headers=auth_headers, json={
        "account_id": acc_id,
        "new_balance": 22000.0,
        "contribution": 1500.0,
        "note": "Bi-weekly payroll contribution + dividend"
    })
    assert val_res.status_code == 200
    data = val_res.json()
    assert data["success"] is True
    assert data["new_balance"] == 22000.0
    assert data["net_contribution"] == 1500.0


