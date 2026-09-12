import pytest
from app.models import Account, TargetConfig, AccountSnapshot, Holding, ManualAccountDetail


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


def test_update_mortgage_payment(client, auth_headers):
    # 1. Create a mortgage manual account with regular monthly payment
    res_create = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Main Residence Mortgage",
        "account_class": "liability",
        "type": "DEBT",
        "subtype": "Mortgage",
        "category_group": "Debt",
        "initial_balance": 350000.0,
        "manual_detail": {
            "original_loan_amount": 400000.0,
            "interest_rate": 5.25,
            "monthly_payment": 2100.0
        }
    })
    assert res_create.status_code == 201
    mort_id = res_create.json()["id"]
    assert res_create.json()["manual_detail"]["monthly_payment"] == 2100.0

    # 2. Update payment to reflect extra principal payment (e.g. +$400 -> $2500)
    res_update = client.put(f"/api/accounts/{mort_id}", headers=auth_headers, json={
        "monthly_payment": 2500.0
    })
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["manual_detail"]["monthly_payment"] == 2500.0

    # 3. Verify fetched account list reflects updated payment
    res_get = client.get("/api/accounts", headers=auth_headers)
    assert res_get.status_code == 200
    account = next(a for a in res_get.json() if a["id"] == mort_id)
    assert account["manual_detail"]["monthly_payment"] == 2500.0


def test_update_account_institution(client, auth_headers):
    # 1. Create a mortgage account with initial institution
    res_create = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Home Loan",
        "account_class": "liability",
        "type": "DEBT",
        "subtype": "Mortgage",
        "category_group": "Debt",
        "initial_balance": 300000.0,
        "manual_detail": {
            "institution_name": "Wells Fargo Home Mortgage",
            "original_loan_amount": 350000.0,
            "interest_rate": 6.0
        }
    })
    assert res_create.status_code == 201
    acc_id = res_create.json()["id"]
    assert res_create.json()["institution_name"] == "Wells Fargo Home Mortgage"

    # 2. Update institution (mortgage transferred/bought by Chase)
    res_update = client.put(f"/api/accounts/{acc_id}", headers=auth_headers, json={
        "institution_name": "Chase Home Lending"
    })
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["institution_name"] == "Chase Home Lending"
    assert updated["manual_detail"]["institution_name"] == "Chase Home Lending"

    # 3. Verify fetched accounts list reflects updated institution
    res_get = client.get("/api/accounts", headers=auth_headers)
    assert res_get.status_code == 200
    account = next(a for a in res_get.json() if a["id"] == acc_id)
    assert account["institution_name"] == "Chase Home Lending"


def test_update_nonexistent_account(client, auth_headers):
    res = client.put("/api/accounts/fake-id-1234", headers=auth_headers, json={
        "name": "New Name"
    })
    assert res.status_code == 404


def test_delete_account_success(client, auth_headers, db_session):
    # 1. Create an account with balance and target rate
    res_create = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Account To Delete",
        "account_class": "asset",
        "type": "investment",
        "subtype": "brokerage",
        "category_group": "Taxable Brokerage",
        "initial_balance": 15000.0,
        "target_annual_return_rate": 7.5
    })
    assert res_create.status_code == 201
    acc_id = res_create.json()["id"]

    # Verify records exist in DB
    assert db_session.query(Account).filter(Account.id == acc_id).first() is not None
    assert db_session.query(AccountSnapshot).filter(AccountSnapshot.account_id == acc_id).count() >= 1
    assert db_session.query(TargetConfig).filter(TargetConfig.account_id == acc_id).first() is not None

    # 2. Delete the account
    res_del = client.delete(f"/api/accounts/{acc_id}", headers=auth_headers)
    assert res_del.status_code == 200
    del_data = res_del.json()
    assert del_data["success"] is True
    assert "Account To Delete" in del_data["message"]
    assert del_data["name"] == "Account To Delete"

    # 3. Verify all DB records cascaded and removed
    assert db_session.query(Account).filter(Account.id == acc_id).first() is None
    assert db_session.query(AccountSnapshot).filter(AccountSnapshot.account_id == acc_id).count() == 0
    assert db_session.query(TargetConfig).filter(TargetConfig.account_id == acc_id).first() is None
    assert db_session.query(Holding).filter(Holding.account_id == acc_id).count() == 0


def test_delete_account_unlinks_linked_asset(client, auth_headers, db_session):
    # Create asset
    res_prop = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Rental Property",
        "account_class": "asset",
        "type": "real_estate",
        "subtype": "property",
        "category_group": "Real Estate",
        "initial_balance": 500000.0
    })
    prop_id = res_prop.json()["id"]

    # Create mortgage linked to property
    res_mort = client.post("/api/accounts/manual", headers=auth_headers, json={
        "name": "Property Mortgage",
        "account_class": "liability",
        "type": "DEBT",
        "subtype": "Mortgage",
        "category_group": "Debt",
        "initial_balance": 350000.0,
        "linked_asset_id": prop_id
    })
    mort_id = res_mort.json()["id"]

    # Verify link
    mort_acc = db_session.query(Account).filter(Account.id == mort_id).first()
    assert mort_acc.linked_asset_id == prop_id

    # Delete the property asset
    res_del = client.delete(f"/api/accounts/{prop_id}", headers=auth_headers)
    assert res_del.status_code == 200

    # Verify mortgage is still active, but linked_asset_id is now None
    db_session.refresh(mort_acc)
    assert mort_acc.linked_asset_id is None


def test_delete_nonexistent_account(client, auth_headers):
    res = client.delete("/api/accounts/fake-nonexistent-id", headers=auth_headers)
    assert res.status_code == 404
