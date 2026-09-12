import base64
import os
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User, Institution, Account, AccountSnapshot, Holding, Transaction, TargetConfig


# Helper for encryption/decryption of access tokens
def get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    try:
        # Ensure 32-byte url-safe base64 key
        if len(key) == 44 and key.endswith("="):
            return Fernet(key.encode())
        else:
            padded = base64.urlsafe_b64encode(key.ljust(32)[:32].encode())
            return Fernet(padded)
    except Exception:
        # Default fallback key
        fallback = base64.urlsafe_b64encode(b"invest-tracker-fallback-key-32b!")
        return Fernet(fallback)


def encrypt_token(token: str) -> str:
    if not token:
        return ""
    f = get_fernet()
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token:
        return ""
    try:
        f = get_fernet()
        return f.decrypt(encrypted_token.encode()).decode()
    except Exception:
        return encrypted_token


def is_plaid_configured() -> bool:
    """Check if valid Plaid API keys are configured via environment."""
    client_id = (os.getenv("PLAID_CLIENT_ID") or settings.PLAID_CLIENT_ID or "").strip()
    secret = (os.getenv("PLAID_SECRET") or settings.PLAID_SECRET or "").strip()
    return bool(client_id and secret)


class PlaidService:
    def __init__(self):
        self._client = None
        self._current_config = None

    @property
    def client_id(self) -> str:
        return (os.getenv("PLAID_CLIENT_ID") or settings.PLAID_CLIENT_ID or "").strip()

    @property
    def secret(self) -> str:
        return (os.getenv("PLAID_SECRET") or settings.PLAID_SECRET or "").strip()

    @property
    def env(self) -> str:
        return (os.getenv("PLAID_ENV") or settings.PLAID_ENV or "sandbox").strip().lower()

    def get_client(self):
        """Lazy load Plaid API Client."""
        if not is_plaid_configured():
            return None
        current_config = (self.client_id, self.secret, self.env)
        if self._client is None or self._current_config != current_config:
            try:
                import plaid
                from plaid.api import plaid_api

                if self.env == "production":
                    host = plaid.Environment.Production
                elif self.env == "development":
                    host = plaid.Environment.Development
                else:
                    host = plaid.Environment.Sandbox

                configuration = plaid.Configuration(
                    host=host,
                    api_key={
                        'clientId': self.client_id,
                        'secret': self.secret,
                    }
                )
                api_client = plaid.ApiClient(configuration)
                self._client = plaid_api.PlaidApi(api_client)
                self._current_config = current_config
            except Exception as e:
                print(f"Error initializing Plaid client: {e}")
                return None
        return self._client

    def create_link_token(self, user_id: str, username: str) -> Dict[str, Any]:
        """Generate Plaid Link token for frontend widget."""
        client = self.get_client()
        if client:
            try:
                from plaid.model.link_token_create_request import LinkTokenCreateRequest
                from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
                from plaid.model.products import Products
                from plaid.model.country_code import CountryCode

                request = LinkTokenCreateRequest(
                    client_id=self.client_id,
                    secret=self.secret,
                    products=[Products("investments"), Products("transactions")],
                    client_name="Invest Tracker",
                    country_codes=[CountryCode("US")],
                    language="en",
                    user=LinkTokenCreateRequestUser(client_user_id=user_id)
                )
                response = client.link_token_create(request)
                return {
                    "link_token": response['link_token'],
                    "expiration": str(response['expiration'])
                }
            except Exception as e:
                print(f"Plaid Link Token error: {e}")
                raise e

        # Fallback / Sandbox Mock link token
        return {
            "link_token": f"link-sandbox-{user_id[:8]}-mock-token",
            "expiration": str(datetime.utcnow() + timedelta(hours=4))
        }

    def exchange_public_token(self, db: Session, user: User, public_token: str, institution_name: str = "Connected Brokerage") -> Institution:
        """Exchange public token for permanent access token and create Institution record."""
        client = self.get_client()
        access_token = f"access-mock-{public_token}"
        item_id = f"item-mock-{datetime.utcnow().timestamp()}"

        if client and not public_token.startswith("link-sandbox-"):
            try:
                from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
                exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
                exchange_response = client.item_public_token_exchange(exchange_request)
                access_token = exchange_response['access_token']
                item_id = exchange_response['item_id']
            except Exception as e:
                print(f"Plaid token exchange error: {e}")

        # Store encrypted access token in DB
        institution = Institution(
            user_id=user.id,
            name=institution_name,
            plaid_item_id=item_id,
            plaid_access_token_encrypted=encrypt_token(access_token),
            is_manual=False,
            created_at=datetime.utcnow(),
            last_sync_at=datetime.utcnow()
        )
        db.add(institution)
        db.commit()
        db.refresh(institution)

        # Initial sync for accounts and holdings
        self.sync_institution(db, user, institution)
        return institution

    def sync_institution(self, db: Session, user: User, institution: Institution) -> Dict[str, int]:
        """Fetch latest balances, holdings, and transactions for an institution."""
        client = self.get_client()
        raw_access_token = decrypt_token(institution.plaid_access_token_encrypted)

        synced_accounts = 0
        created_snapshots = 0
        synced_holdings = 0
        now = datetime.utcnow()

        if institution.is_manual:
            return {
                "synced_accounts": 0,
                "created_snapshots": 0,
                "synced_holdings": 0
            }

        if client and raw_access_token and not raw_access_token.startswith("access-mock-"):
            try:
                from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
                request = InvestmentsHoldingsGetRequest(access_token=raw_access_token)
                response = client.investments_holdings_get(request)
                
                # Map plaid securities
                securities_map = {sec['security_id']: sec for sec in response.get('securities', [])}

                # Sync accounts
                for acc_data in response.get('accounts', []):
                    account = db.query(Account).filter(
                        Account.institution_id == institution.id,
                        Account.plaid_account_id == acc_data['account_id']
                    ).first()

                    balance = float(acc_data['balances'].get('current') or 0.0)
                    available = float(acc_data['balances'].get('available') or balance)

                    if not account:
                        raw_sub = (acc_data.get('subtype') or '').lower()
                        raw_type = (acc_data.get('type') or '').lower()

                        if "401k" in raw_sub or "403b" in raw_sub or "457b" in raw_sub:
                            std_type = "TAX-DEFERRED"
                            std_subtype = "401(k)" if "401k" in raw_sub else ("403(b)" if "403b" in raw_sub else "457(b)")
                            category = "Retirement"
                        elif "roth" in raw_sub:
                            std_type = "TAX-FREE"
                            std_subtype = "Roth IRA" if "ira" in raw_sub else "Roth 401(k)"
                            category = "IRAs" if "ira" in raw_sub else "Retirement"
                        elif "ira" in raw_sub:
                            std_type = "TAX-DEFERRED"
                            std_subtype = "IRA"
                            category = "IRAs"
                        elif "hsa" in raw_sub:
                            std_type = "TAX-FREE"
                            std_subtype = "HSA"
                            category = "Other"
                        elif "529" in raw_sub:
                            std_type = "TAX-FREE"
                            std_subtype = "529"
                            category = "Other"
                        elif "savings" in raw_sub or raw_type == "depository":
                            std_type = "TAXABLE"
                            std_subtype = "Savings" if "savings" in raw_sub else "Checking"
                            category = "Emergency Savings"
                        else:
                            std_type = "TAXABLE"
                            std_subtype = "Investment"
                            category = "Taxable Brokerage"

                        account = Account(
                            user_id=user.id,
                            institution_id=institution.id,
                            source_type="plaid",
                            account_class="asset",
                            plaid_account_id=acc_data['account_id'],
                            name=acc_data.get('name') or "Investment Account",
                            official_name=acc_data.get('official_name'),
                            mask=acc_data.get('mask'),
                            type=std_type,
                            subtype=std_subtype,
                            category_group=category,
                            currency=acc_data['balances'].get('iso_currency_code') or "USD",
                            is_active=True
                        )
                        db.add(account)
                        db.commit()
                        db.refresh(account)

                        # Set default target return
                        target = TargetConfig(account_id=account.id, target_annual_return_rate=7.5)
                        db.add(target)
                        db.commit()

                    synced_accounts += 1

                    # Record Snapshot
                    snapshot = AccountSnapshot(
                        account_id=account.id,
                        snapshot_timestamp=now,
                        current_balance=balance,
                        available_balance=available,
                        market_value_total=balance,
                        note="Plaid on-demand sync"
                    )
                    db.add(snapshot)
                    created_snapshots += 1

                # Sync Holdings
                for h_data in response.get('holdings', []):
                    acc = db.query(Account).filter(Account.plaid_account_id == h_data['account_id']).first()
                    if not acc:
                        continue
                    sec = securities_map.get(h_data['security_id'], {})
                    ticker = sec.get('ticker_symbol')
                    name = sec.get('name') or ticker or "Investment Holding"
                    sec_type = (sec.get('type') or 'equity').lower()
                    
                    qty = float(h_data.get('quantity') or 1.0)
                    price = float(h_data.get('institution_price') or 0.0)
                    val = float(h_data.get('institution_value') or (qty * price))
                    cost = float(h_data.get('cost_basis') or val)

                    # Determine risk tier
                    risk_tier, risk_score = self.classify_risk(sec_type, ticker)

                    # Clean old holdings for account and re-insert
                    db.query(Holding).filter(Holding.account_id == acc.id).delete()
                    holding = Holding(
                        account_id=acc.id,
                        plaid_security_id=h_data.get('security_id'),
                        ticker_symbol=ticker,
                        name=name,
                        asset_type=sec_type,
                        quantity=qty,
                        institution_price=price,
                        institution_value=val,
                        cost_basis=cost,
                        risk_tier=risk_tier,
                        risk_score=risk_score,
                        as_of_date=now
                    )
                    db.add(holding)
                    synced_holdings += 1

                institution.last_sync_at = now
                institution.sync_error = None
                for acc in institution.accounts:
                    acc.sync_error = None
                db.commit()

                return {
                    "synced_accounts": synced_accounts,
                    "created_snapshots": created_snapshots,
                    "synced_holdings": synced_holdings
                }

            except Exception as e:
                print(f"Error during Plaid live sync: {e}")
                institution.sync_error = str(e)
                for acc in institution.accounts:
                    acc.sync_error = str(e)
                db.commit()
                raise e

        # Mock Sync Behavior when Plaid is in mock/sandbox mode
        return self._sync_mock_institution(db, user, institution, now)

    def _sync_mock_institution(self, db, user, institution, now: datetime) -> Dict[str, int]:
        """Deterministic mock sync update for sandbox / demo institutions."""
        accounts = db.query(Account).filter(Account.institution_id == institution.id).all()
        created_snapshots = 0
        synced_holdings = 0

        if not accounts:
            # Create default mock account
            acc = Account(
                user_id=user.id,
                institution_id=institution.id,
                source_type="plaid",
                account_class="asset",
                plaid_account_id=f"acc-mock-{institution.id[:6]}",
                name=f"{institution.name} Core Investment",
                type="TAXABLE",
                subtype="Investment",
                category_group="Taxable Brokerage",
                currency="USD",
                is_active=True
            )
            db.add(acc)
            db.commit()
            db.refresh(acc)

            target = TargetConfig(account_id=acc.id, target_annual_return_rate=8.0)
            db.add(target)
            db.commit()
            accounts = [acc]

        for acc in accounts:
            last_snap = db.query(AccountSnapshot).filter(AccountSnapshot.account_id == acc.id).order_by(AccountSnapshot.snapshot_timestamp.desc()).first()
            prev_balance = last_snap.current_balance if last_snap else 50000.0
            
            # Slight randomized market movement
            new_balance = round(prev_balance * 1.0025, 2)
            snap = AccountSnapshot(
                account_id=acc.id,
                snapshot_timestamp=now,
                current_balance=new_balance,
                available_balance=new_balance,
                market_value_total=new_balance,
                note="Sync update"
            )
            db.add(snap)
            created_snapshots += 1

            # Update holdings
            existing_holdings = db.query(Holding).filter(Holding.account_id == acc.id).all()
            if not existing_holdings:
                h1 = Holding(
                    account_id=acc.id,
                    ticker_symbol="VOO",
                    name="Vanguard S&P 500 ETF",
                    asset_type="etf",
                    quantity=80.0,
                    institution_price=510.0,
                    institution_value=40800.0,
                    cost_basis=36000.0,
                    risk_tier="Moderate",
                    risk_score=3.2,
                    as_of_date=now
                )
                h2 = Holding(
                    account_id=acc.id,
                    ticker_symbol="BND",
                    name="Vanguard Total Bond Market ETF",
                    asset_type="fixed_income",
                    quantity=130.0,
                    institution_price=72.0,
                    institution_value=9360.0,
                    cost_basis=9500.0,
                    risk_tier="Low",
                    risk_score=1.8,
                    as_of_date=now
                )
                db.add_all([h1, h2])
                synced_holdings += 2

        institution.last_sync_at = now
        institution.sync_error = None
        for acc in accounts:
            acc.sync_error = None
        db.commit()

        return {
            "synced_accounts": len(accounts),
            "created_snapshots": created_snapshots,
            "synced_holdings": synced_holdings
        }

    @staticmethod
    def classify_risk(asset_type: str, ticker: Optional[str] = None) -> (str, float):
        """Map asset class and ticker to 5-tier risk rating (1.0 to 5.0)."""
        asset_type = (asset_type or "").lower()
        ticker = (ticker or "").upper()

        if asset_type in ["cash", "depository", "money_market", "currency"]:
            return "Very Low", 1.0
        elif asset_type in ["fixed_income", "bond", "treasury", "cd"]:
            return "Low", 2.0
        elif asset_type in ["real_estate", "reit"]:
            return "Moderate", 3.0
        elif asset_type in ["etf", "mutual_fund", "index"]:
            if any(t in ticker for t in ["QQQ", "ARKK", "SOXX", "SMH"]):
                return "High", 4.2
            return "Moderate", 3.2
        elif asset_type in ["equity", "stock"]:
            if any(t in ticker for t in ["NVDA", "TSLA", "AMD", "PLTR", "COIN"]):
                return "High", 4.5
            return "Moderate", 3.8
        elif asset_type in ["crypto", "derivative", "option", "alternative"]:
            return "Very High", 5.0
        else:
            return "Moderate", 3.0


plaid_service = PlaidService()
