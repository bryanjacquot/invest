import pytest
from app.models import Account, Holding, AccountSnapshot, TargetConfig


def test_seed_demo_portfolio_endpoint(client, auth_headers):
    res = client.post("/api/seed/demo-portfolio", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["details"]["institutions_created"] == 4
    assert data["details"]["accounts_created"] == 6
    assert data["details"]["snapshots_created"] > 100
    assert data["details"]["holdings_created"] == 10

    # Verify accounts endpoint now returns populated data
    res_acc = client.get("/api/accounts", headers=auth_headers)
    assert res_acc.status_code == 200
    accounts = res_acc.json()
    assert len(accounts) == 6

    # Check IRA account is present
    ira_accs = [a for a in accounts if a["category_group"] == "IRAs"]
    assert len(ira_accs) == 1
    assert ira_accs[0]["name"] == "Schwab Roth IRA"

    # Check emergency savings account is present
    emergency_accs = [a for a in accounts if a["category_group"] == "Emergency Savings"]
    assert len(emergency_accs) == 1
    assert emergency_accs[0]["name"] == "Ally High Yield Savings"
    assert emergency_accs[0]["current_balance"] > 0

    # Check real estate property and mortgage
    real_estate_accs = [a for a in accounts if a["type"] == "real_estate"]
    assert len(real_estate_accs) == 1
    prop = real_estate_accs[0]
    assert prop["name"] == "Primary Residence (123 Maple St)"

    mortgage_accs = [a for a in accounts if a["type"] == "loan"]
    assert len(mortgage_accs) == 1
    assert mortgage_accs[0]["linked_asset_id"] == prop["id"]
