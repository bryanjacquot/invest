from datetime import datetime, date
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status

from app.models import (
    User,
    Institution,
    Account,
    ManualAccountDetail,
    TargetConfig,
    AccountSnapshot,
    Holding,
)
from app.schemas import (
    ManualAccountCreate,
    AccountUpdate,
    ValuationLogCreate,
    RealEstateEquityOut,
)


class ManualAssetService:
    @staticmethod
    def get_or_create_manual_institution(db: Session, user: User) -> Institution:
        """Fetch or initialize the default manual institution container for user."""
        inst = db.query(Institution).filter(
            Institution.user_id == user.id,
            Institution.is_manual == True
        ).first()

        if not inst:
            inst = Institution(
                user_id=user.id,
                name="Manual Portfolio & Real Estate",
                is_manual=True,
                created_at=datetime.utcnow(),
                last_sync_at=datetime.utcnow()
            )
            db.add(inst)
            db.commit()
            db.refresh(inst)
        return inst

    @classmethod
    def create_manual_account(
        cls,
        db: Session,
        user: User,
        data: ManualAccountCreate
    ) -> Account:
        """Create a new manual asset or liability account with bidirectional linking."""
        institution = cls.get_or_create_manual_institution(db, user)

        # Validate linked account if specified
        linked = None
        if data.linked_asset_id:
            linked = db.query(Account).filter(
                Account.id == data.linked_asset_id,
                Account.user_id == user.id
            ).first()
            if not linked:
                raise HTTPException(status_code=400, detail="Linked account not found")

        # Create account record
        account = Account(
            user_id=user.id,
            institution_id=institution.id,
            linked_asset_id=data.linked_asset_id,
            source_type="manual",
            account_class=data.account_class,
            name=data.name,
            type=data.type,
            subtype=data.subtype,
            category_group=data.category_group,
            currency=data.currency or "USD",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(account)
        db.flush()

        # Update the linked account bidirectionally
        if linked:
            linked.linked_asset_id = account.id

        # Create target config
        target_rate = data.target_annual_return_rate if data.target_annual_return_rate is not None else (4.0 if data.type == "real_estate" else 7.0)
        target = TargetConfig(
            account_id=account.id,
            target_annual_return_rate=target_rate,
            notes=f"Target return for {account.name}"
        )
        db.add(target)

        # Create manual detail if provided
        if data.manual_detail:
            detail = ManualAccountDetail(
                account_id=account.id,
                description=data.manual_detail.description,
                property_address=data.manual_detail.property_address,
                purchase_date=data.manual_detail.purchase_date,
                purchase_price=data.manual_detail.purchase_price,
                original_loan_amount=data.manual_detail.original_loan_amount,
                interest_rate=data.manual_detail.interest_rate,
                monthly_payment=data.manual_detail.monthly_payment,
                maturity_date=data.manual_detail.maturity_date,
                notes=data.manual_detail.notes
            )
            db.add(detail)

        # Record initial snapshot
        initial_val = data.initial_balance
        snapshot = AccountSnapshot(
            account_id=account.id,
            snapshot_timestamp=datetime.utcnow(),
            current_balance=initial_val,
            available_balance=initial_val,
            cost_basis_total=data.manual_detail.purchase_price if data.manual_detail and data.manual_detail.purchase_price else initial_val,
            market_value_total=initial_val,
            note="Initial valuation entry"
        )
        db.add(snapshot)

        # If it's a real estate or physical asset, create a corresponding holding record
        if data.account_class == "asset":
            asset_type = "real_estate" if data.type == "real_estate" else (data.subtype or "other")
            risk_tier = "Moderate" if data.type == "real_estate" else "High"
            risk_score = 3.0 if data.type == "real_estate" else 4.0
            holding = Holding(
                account_id=account.id,
                ticker_symbol="PROP" if data.type == "real_estate" else "ASSET",
                name=data.name,
                asset_type=asset_type,
                quantity=1.0,
                institution_price=initial_val,
                institution_value=initial_val,
                cost_basis=data.manual_detail.purchase_price if data.manual_detail and data.manual_detail.purchase_price else initial_val,
                risk_tier=risk_tier,
                risk_score=risk_score,
                as_of_date=datetime.utcnow()
            )
            db.add(holding)

        db.commit()
        db.refresh(account)
        return account

    @staticmethod
    def update_account(
        db: Session,
        user: User,
        account_id: str,
        data: AccountUpdate
    ) -> Account:
        """Update account properties like category group, name, target return, or linked asset (bidirectionally)."""
        account = db.query(Account).filter(
            Account.id == account_id,
            Account.user_id == user.id
        ).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        if data.name is not None:
            account.name = data.name
        if data.type is not None:
            account.type = data.type
        if data.subtype is not None:
            account.subtype = data.subtype
        if data.category_group is not None:
            account.category_group = data.category_group
        if data.is_active is not None:
            account.is_active = data.is_active

        if data.linked_asset_id is not None:
            old_linked_id = account.linked_asset_id
            new_linked_id = data.linked_asset_id if data.linked_asset_id != "" else None

            # If old link existed and is changing/removed, clear the other account's pointer
            if old_linked_id and old_linked_id != new_linked_id:
                old_linked = db.query(Account).filter(
                    Account.id == old_linked_id,
                    Account.user_id == user.id
                ).first()
                if old_linked and old_linked.linked_asset_id == account.id:
                    old_linked.linked_asset_id = None

            if new_linked_id:
                linked = db.query(Account).filter(
                    Account.id == new_linked_id,
                    Account.user_id == user.id
                ).first()
                if not linked:
                    raise HTTPException(status_code=400, detail="Linked account not found")
                account.linked_asset_id = new_linked_id
                # Establish bidirectional pointer
                linked.linked_asset_id = account.id
            else:
                account.linked_asset_id = None

        if data.target_annual_return_rate is not None:
            if account.target_config:
                account.target_config.target_annual_return_rate = data.target_annual_return_rate
            else:
                target = TargetConfig(
                    account_id=account.id,
                    target_annual_return_rate=data.target_annual_return_rate
                )
                db.add(target)

        db.commit()
        db.refresh(account)
        return account

    @staticmethod
    def log_valuation(
        db: Session,
        user: User,
        data: ValuationLogCreate
    ) -> AccountSnapshot:
        """Log a new appraisal, valuation, or loan balance update."""
        account = db.query(Account).filter(
            Account.id == data.account_id,
            Account.user_id == user.id
        ).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        timestamp = data.date or datetime.utcnow()
        snapshot = AccountSnapshot(
            account_id=account.id,
            snapshot_timestamp=timestamp,
            current_balance=data.new_balance,
            available_balance=data.new_balance,
            market_value_total=data.new_balance,
            note=data.note or "Manual valuation update"
        )
        db.add(snapshot)

        # Also update latest holding price if asset
        holding = db.query(Holding).filter(Holding.account_id == account.id).first()
        if holding:
            holding.institution_price = data.new_balance
            holding.institution_value = data.new_balance
            holding.as_of_date = timestamp

        db.commit()
        db.refresh(snapshot)
        return snapshot

    @staticmethod
    def get_real_estate_equity_summary(db: Session, user: User) -> List[RealEstateEquityOut]:
        """Compute real estate properties, linked mortgages, equity, and LTV ratios."""
        properties = db.query(Account).filter(
            Account.user_id == user.id,
            or_(
                Account.type == "REAL-ESTATE, OTHER",
                Account.type == "real_estate",
                Account.subtype == "Real Estate / Property",
                Account.category_group == "Real Estate"
            ),
            Account.account_class == "asset",
            Account.is_active == True
        ).all()

        results = []
        for prop in properties:
            # Latest property market value
            last_prop_snap = db.query(AccountSnapshot).filter(
                AccountSnapshot.account_id == prop.id
            ).order_by(AccountSnapshot.snapshot_timestamp.desc()).first()
            market_val = last_prop_snap.current_balance if last_prop_snap else 0.0

            # Find linked mortgage / loan bidirectionally
            mortgage = None
            if prop.linked_asset_id:
                mortgage = db.query(Account).filter(
                    Account.id == prop.linked_asset_id,
                    Account.user_id == user.id,
                    Account.is_active == True
                ).first()
            if not mortgage:
                mortgage = db.query(Account).filter(
                    Account.linked_asset_id == prop.id,
                    Account.user_id == user.id,
                    Account.is_active == True
                ).first()

            mortgage_balance = 0.0
            mortgage_id = None
            mortgage_name = None
            interest_rate = None
            monthly_payment = None

            if mortgage:
                mortgage_id = mortgage.id
                mortgage_name = mortgage.name
                last_mortgage_snap = db.query(AccountSnapshot).filter(
                    AccountSnapshot.account_id == mortgage.id
                ).order_by(AccountSnapshot.snapshot_timestamp.desc()).first()
                mortgage_balance = last_mortgage_snap.current_balance if last_mortgage_snap else 0.0
                if mortgage.manual_detail:
                    interest_rate = mortgage.manual_detail.interest_rate
                    monthly_payment = mortgage.manual_detail.monthly_payment

            equity_val = max(0.0, market_val - mortgage_balance)
            equity_pct = round((equity_val / market_val * 100.0), 2) if market_val > 0 else 0.0
            ltv_pct = round((mortgage_balance / market_val * 100.0), 2) if market_val > 0 else 0.0

            prop_address = prop.manual_detail.property_address if prop.manual_detail else None

            results.append(RealEstateEquityOut(
                property_account_id=prop.id,
                property_name=prop.name,
                property_address=prop_address,
                market_value=market_val,
                mortgage_account_id=mortgage_id,
                mortgage_name=mortgage_name,
                mortgage_balance=mortgage_balance,
                equity_value=equity_val,
                equity_pct=equity_pct,
                ltv_pct=ltv_pct,
                interest_rate=interest_rate,
                monthly_payment=monthly_payment
            ))
        return results

    @staticmethod
    def delete_account(
        db: Session,
        user: User,
        account_id: str
    ) -> Dict[str, Any]:
        """Permanently delete an account and all associated DB records (snapshots, holdings, transactions, target config, manual details)."""
        account = db.query(Account).filter(
            Account.id == account_id,
            Account.user_id == user.id
        ).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Account with ID '{account_id}' not found"
            )

        account_name = account.name
        institution_id = account.institution_id

        # 1. Unlink any accounts pointing to this account as linked_asset_id
        linked_accounts = db.query(Account).filter(
            Account.linked_asset_id == account_id
        ).all()
        for la in linked_accounts:
            la.linked_asset_id = None

        # 2. Delete the account (SQLAlchemy cascades delete to manual_detail, target_config, snapshots, holdings, transactions)
        db.delete(account)
        db.flush()

        # 3. Clean up parent institution if it was manual and has 0 remaining accounts
        if institution_id:
            remaining_accounts = db.query(Account).filter(
                Account.institution_id == institution_id
            ).count()
            if remaining_accounts == 0:
                inst = db.query(Institution).filter(Institution.id == institution_id).first()
                if inst:
                    db.delete(inst)

        db.commit()
        return {
            "success": True,
            "message": f"Account '{account_name}' successfully deleted",
            "name": account_name,
            "account_id": account_id
        }


manual_asset_service = ManualAssetService()
