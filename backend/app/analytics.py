from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models import (
    User,
    Institution,
    Account,
    AccountSnapshot,
    Holding,
    Transaction,
    TargetConfig,
)
from app.schemas import (
    NetWorthSummary,
    PerformanceResponse,
    TimeframePerformance,
    ChartPoint,
    RiskProfileResponse,
    HoldingOut,
)


class AnalyticsEngine:
    @staticmethod
    def get_timeframe_start_date(timeframe: str, first_available_date: Optional[datetime] = None) -> datetime:
        """Calculate start datetime for a given timeframe horizon."""
        now = datetime.utcnow()
        timeframe = timeframe.upper()

        if timeframe == "1M":
            return now - timedelta(days=30)
        elif timeframe == "YTD":
            return datetime(now.year, 1, 1)
        elif timeframe == "1Y":
            return now - timedelta(days=365)
        elif timeframe == "3Y":
            return now - timedelta(days=365 * 3)
        elif timeframe == "5Y":
            return now - timedelta(days=365 * 5)
        elif timeframe == "LIFETIME":
            return first_available_date if first_available_date else (now - timedelta(days=365 * 5))
        else:
            return now - timedelta(days=30)

    @classmethod
    def get_net_worth_summary(cls, db: Session, user: User) -> NetWorthSummary:
        """Calculate aggregate net worth metrics and trailing period changes."""
        accounts = db.query(Account).filter(
            Account.user_id == user.id,
            Account.is_active == True
        ).all()

        now = datetime.utcnow()
        date_1m = now - timedelta(days=30)
        date_ytd = datetime(now.year, 1, 1)
        date_1y = now - timedelta(days=365)

        total_invested = 0.0
        total_retirement = 0.0
        total_taxable_brokerage = 0.0
        total_iras = 0.0
        total_real_estate = 0.0
        total_other_assets = 0.0
        total_liabilities = 0.0
        total_mortgages = 0.0
        total_emergency_savings = 0.0

        val_now_total = 0.0
        val_1m_total = 0.0
        val_ytd_total = 0.0
        val_1y_total = 0.0
        last_sync = None

        for acc in accounts:
            # Latest snapshot
            snaps = db.query(AccountSnapshot).filter(
                AccountSnapshot.account_id == acc.id
            ).order_by(AccountSnapshot.snapshot_timestamp.asc()).all()

            if not snaps:
                continue

            last_snap = snaps[-1]
            if not last_sync or (last_snap.snapshot_timestamp and last_snap.snapshot_timestamp > last_sync):
                last_sync = last_snap.snapshot_timestamp

            curr_val = last_snap.current_balance
            multiplier = -1.0 if acc.account_class == "liability" else 1.0
            val_now_total += curr_val * multiplier

            # Category allocation
            if acc.account_class == "liability" or acc.type == "DEBT" or acc.category_group in ["Debt", "Mortgages", "Mortgage"]:
                total_liabilities += curr_val
                total_mortgages += curr_val
            elif (acc.type == "TAXABLE" and acc.subtype in ["Savings", "Checking", "savings", "checking"]) or acc.category_group == "Emergency Savings":
                total_emergency_savings += curr_val
                total_other_assets += curr_val
            elif acc.type in ["REAL-ESTATE, OTHER", "real_estate"] or acc.category_group == "Real Estate":
                total_real_estate += curr_val
            elif acc.type in ["TAX-DEFERRED", "TAX-DEFFERRED"] or acc.category_group == "Retirement" or acc.subtype in ["401(k)", "401k", "403(b)", "403b", "457(b)", "457b"]:
                total_retirement += curr_val
                total_invested += curr_val
            elif (acc.type == "TAXABLE" and acc.subtype in ["Investment", "brokerage"]) or acc.category_group == "Taxable Brokerage":
                total_taxable_brokerage += curr_val
                total_invested += curr_val
            elif acc.type == "TAX-FREE" or acc.category_group in ["IRAs", "IRA"] or (acc.subtype and any(k in acc.subtype.lower() for k in ["ira", "529", "hsa", "roth"])):
                total_iras += curr_val
                total_invested += curr_val
            elif acc.type in ["investment", "TAXABLE"]:
                total_invested += curr_val
            else:
                total_other_assets += curr_val

            # Historical points for 1M, YTD, 1Y
            val_1m = cls._get_balance_at_date(snaps, date_1m)
            val_ytd = cls._get_balance_at_date(snaps, date_ytd)
            val_1y = cls._get_balance_at_date(snaps, date_1y)

            val_1m_total += val_1m * multiplier
            val_ytd_total += val_ytd * multiplier
            val_1y_total += val_1y * multiplier

        total_net_worth = total_invested + total_real_estate + total_other_assets - total_liabilities

        # Changes
        change_1m_dollars = total_net_worth - val_1m_total if val_1m_total else 0.0
        change_1m_pct = (change_1m_dollars / val_1m_total * 100.0) if val_1m_total > 0 else 0.0

        change_ytd_dollars = total_net_worth - val_ytd_total if val_ytd_total else 0.0
        change_ytd_pct = (change_ytd_dollars / val_ytd_total * 100.0) if val_ytd_total > 0 else 0.0

        change_1y_dollars = total_net_worth - val_1y_total if val_1y_total else 0.0
        change_1y_pct = (change_1y_dollars / val_1y_total * 100.0) if val_1y_total > 0 else 0.0

        return NetWorthSummary(
            total_net_worth=round(total_net_worth, 2),
            total_invested_assets=round(total_invested, 2),
            total_retirement=round(total_retirement, 2),
            total_taxable_brokerage=round(total_taxable_brokerage, 2),
            total_iras=round(total_iras, 2),
            total_real_estate_assets=round(total_real_estate, 2),
            total_other_assets=round(total_other_assets, 2),
            total_liabilities=round(total_liabilities, 2),
            total_mortgages=round(total_mortgages, 2),
            total_emergency_savings=round(total_emergency_savings, 2),
            change_1m_dollars=round(change_1m_dollars, 2),
            change_1m_pct=round(change_1m_pct, 2),
            change_ytd_dollars=round(change_ytd_dollars, 2),
            change_ytd_pct=round(change_ytd_pct, 2),
            change_1y_dollars=round(change_1y_dollars, 2),
            change_1y_pct=round(change_1y_pct, 2),
            last_synced_at=last_sync
        )

    @classmethod
    def get_performance(
        cls,
        db: Session,
        user: User,
        account_filter: str = "all",
        active_timeframe: str = "1Y"
    ) -> PerformanceResponse:
        """Compute performance analytics across all supported timeframes with chart series and table."""
        target_accounts = cls._filter_accounts(db, user, account_filter)
        if not target_accounts:
            return cls._empty_performance_response(account_filter, active_timeframe)

        # Collect snapshots per account
        acc_ids = [a.id for a in target_accounts]
        snapshots = db.query(AccountSnapshot).filter(
            AccountSnapshot.account_id.in_(acc_ids)
        ).order_by(AccountSnapshot.snapshot_timestamp.asc()).all()

        if not snapshots:
            return cls._empty_performance_response(account_filter, active_timeframe)

        first_snap_date = snapshots[0].snapshot_timestamp
        timeframes = ["1M", "YTD", "1Y", "3Y", "5Y", "Lifetime"]
        timeframe_metrics = {}

        # Weighted annual target rate
        blended_target_rate = cls._calculate_blended_target_rate(target_accounts)

        for tf in timeframes:
            start_date = cls.get_timeframe_start_date(tf, first_snap_date)
            perf = cls._compute_interval_performance(target_accounts, snapshots, start_date, datetime.utcnow(), blended_target_rate, tf)
            timeframe_metrics[tf] = perf

        # Generate chart points for active timeframe
        active_start_date = cls.get_timeframe_start_date(active_timeframe, first_snap_date)
        chart_series = cls._generate_chart_series(target_accounts, snapshots, active_start_date, datetime.utcnow(), blended_target_rate)

        # Account breakdown table
        account_breakdown = []
        for acc in target_accounts:
            acc_snaps = [s for s in snapshots if s.account_id == acc.id]
            acc_target = acc.target_config.target_annual_return_rate if acc.target_config else blended_target_rate
            acc_perf = cls._compute_interval_performance([acc], acc_snaps, active_start_date, datetime.utcnow(), acc_target, active_timeframe)
            account_breakdown.append({
                "account_id": acc.id,
                "account_name": acc.name,
                "category_group": acc.category_group,
                "account_class": acc.account_class,
                "target_rate_pct": acc_target,
                "start_balance": acc_perf.start_balance,
                "end_balance": acc_perf.end_balance,
                "gain_loss": acc_perf.capital_gain_loss,
                "return_pct": acc_perf.return_pct,
                "target_return_pct": acc_perf.target_return_pct,
                "variance_dollars": acc_perf.variance_dollars,
                "variance_pct": acc_perf.variance_pct,
                "ahead_of_target": acc_perf.ahead_of_target
            })

        return PerformanceResponse(
            account_filter=account_filter,
            timeframe=active_timeframe,
            timeframe_metrics=timeframe_metrics,
            chart_series=chart_series,
            account_breakdown=account_breakdown
        )

    @classmethod
    def get_risk_profile(cls, db: Session, user: User, account_filter: str = "all") -> RiskProfileResponse:
        """Compute portfolio asset allocation and 5-tier risk rating scores."""
        target_accounts = cls._filter_accounts(db, user, account_filter)
        if not target_accounts:
            return RiskProfileResponse(
                blended_risk_score=3.0,
                blended_risk_tier="Moderate",
                asset_allocation=[],
                account_risks=[]
            )

        acc_ids = [a.id for a in target_accounts]
        holdings = db.query(Holding).filter(Holding.account_id.in_(acc_ids)).all()

        # Category sums
        category_map = {
            "Equities / ETFs": {"val": 0.0, "risk": 3.6},
            "Fixed Income / Bonds": {"val": 0.0, "risk": 1.8},
            "Real Estate": {"val": 0.0, "risk": 3.0},
            "Cash & Equivalents": {"val": 0.0, "risk": 1.0},
            "Alternatives / Other": {"val": 0.0, "risk": 4.5}
        }

        total_value = 0.0
        account_risk_data = {}

        for acc in target_accounts:
            account_risk_data[acc.id] = {
                "account_id": acc.id,
                "account_name": acc.name,
                "weighted_risk": 0.0,
                "value": 0.0
            }

        for h in holdings:
            val = max(0.0, h.institution_value)
            total_value += val
            t = (h.asset_type or "").lower()

            if t in ["equity", "stock", "etf", "mutual_fund"]:
                cat = "Equities / ETFs"
            elif t in ["fixed_income", "bond", "treasury", "cd"]:
                cat = "Fixed Income / Bonds"
            elif t in ["real_estate", "property"]:
                cat = "Real Estate"
            elif t in ["cash", "depository", "money_market", "currency"]:
                cat = "Cash & Equivalents"
            else:
                cat = "Alternatives / Other"

            category_map[cat]["val"] += val
            category_map[cat]["risk"] = ((category_map[cat]["risk"] + h.risk_score) / 2.0)

            if h.account_id in account_risk_data:
                account_risk_data[h.account_id]["value"] += val
                account_risk_data[h.account_id]["weighted_risk"] += (val * h.risk_score)

        # Calculate blended risk score
        weighted_score_sum = sum(
            category_map[c]["val"] * category_map[c]["risk"] for c in category_map
        )
        blended_score = round(weighted_score_sum / total_value, 2) if total_value > 0 else 3.0
        blended_tier = cls._score_to_tier(blended_score)

        # Asset allocation list
        allocation = []
        for cat_name, data in category_map.items():
            if data["val"] > 0 or total_value == 0:
                pct = round((data["val"] / total_value * 100.0), 2) if total_value > 0 else 0.0
                allocation.append({
                    "category": cat_name,
                    "value": round(data["val"], 2),
                    "pct": pct,
                    "risk_score": round(data["risk"], 2)
                })

        # Account risks list
        account_risks = []
        for acc_id, data in account_risk_data.items():
            acc_val = data["value"]
            acc_score = round(data["weighted_risk"] / acc_val, 2) if acc_val > 0 else 3.0
            account_risks.append({
                "account_id": acc_id,
                "account_name": data["account_name"],
                "value": round(acc_val, 2),
                "risk_score": acc_score,
                "risk_tier": cls._score_to_tier(acc_score)
            })

        return RiskProfileResponse(
            blended_risk_score=blended_score,
            blended_risk_tier=blended_tier,
            asset_allocation=allocation,
            account_risks=account_risks
        )

    @classmethod
    def get_all_holdings(cls, db: Session, user: User, account_filter: str = "all") -> List[HoldingOut]:
        """Fetch all granular holdings with cost basis, gains, and portfolio weight."""
        target_accounts = cls._filter_accounts(db, user, account_filter)
        acc_ids = [a.id for a in target_accounts]
        acc_names = {a.id: a.name for a in target_accounts}

        holdings = db.query(Holding).filter(Holding.account_id.in_(acc_ids)).all()
        total_portfolio_value = sum(max(0.0, h.institution_value) for h in holdings) or 1.0

        results = []
        for h in holdings:
            val = h.institution_value
            cost = h.cost_basis if h.cost_basis is not None else val
            gain_loss = val - cost
            gain_pct = round((gain_loss / cost * 100.0), 2) if cost > 0 else 0.0
            weight_pct = round((val / total_portfolio_value * 100.0), 2)

            results.append(HoldingOut(
                id=h.id,
                account_id=h.account_id,
                account_name=acc_names.get(h.account_id, "Unknown"),
                ticker_symbol=h.ticker_symbol,
                name=h.name,
                asset_type=h.asset_type,
                quantity=h.quantity,
                institution_price=h.institution_price,
                institution_value=h.institution_value,
                cost_basis=cost,
                unrealized_gain_loss=round(gain_loss, 2),
                unrealized_gain_loss_pct=gain_pct,
                portfolio_weight_pct=weight_pct,
                risk_tier=h.risk_tier,
                risk_score=h.risk_score,
                as_of_date=h.as_of_date
            ))
        return results

    # =========================================================================
    # Internal Computation Helpers
    # =========================================================================
    @staticmethod
    def _filter_accounts(db: Session, user: User, account_filter: str) -> List[Account]:
        """Filter user accounts by single ID, category group, or comma-separated list of categories/IDs."""
        query = db.query(Account).filter(Account.user_id == user.id, Account.is_active == True)

        if not account_filter or account_filter == "all":
            return query.all()

        tokens = [t.strip().lower() for t in account_filter.split(",") if t.strip()]
        if not tokens or "all" in tokens:
            return query.all()

        matched_categories = []
        matched_ids = []
        known_cats = {"retirement", "taxable brokerage", "iras", "ira", "emergency savings", "real estate", "debt", "mortgages", "mortgage", "other"}

        for t in tokens:
            if t in ["mortgages", "mortgage"]:
                matched_categories.extend(["debt", "mortgages", "mortgage"])
            elif t in ["iras", "ira"]:
                matched_categories.extend(["iras", "ira"])
            elif t in known_cats:
                matched_categories.append(t)
            else:
                matched_ids.append(t)

        conditions = []
        if matched_categories:
            conditions.append(func.lower(Account.category_group).in_(matched_categories))
        if matched_ids:
            # Match account.id case-insensitively or exact
            conditions.append(func.lower(Account.id).in_(matched_ids))

        if conditions:
            return query.filter(or_(*conditions)).all()

        return query.all()

    @staticmethod
    def _calculate_blended_target_rate(accounts: List[Account]) -> float:
        """Calculate weighted or average target return rate for accounts."""
        rates = [a.target_config.target_annual_return_rate for a in accounts if a.target_config]
        return round(sum(rates) / len(rates), 2) if rates else 7.0

    @classmethod
    def _compute_interval_performance(
        cls,
        accounts: List[Account],
        snapshots: List[AccountSnapshot],
        start_date: datetime,
        end_date: datetime,
        annual_target_rate: float,
        timeframe_name: str
    ) -> TimeframePerformance:
        """Calculate start balance, end balance, TWR return %, target curve value, and variance."""
        start_bal = 0.0
        end_bal = 0.0

        for acc in accounts:
            acc_snaps = [s for s in snapshots if s.account_id == acc.id]
            multiplier = -1.0 if acc.account_class == "liability" else 1.0
            if acc_snaps:
                sb = cls._get_balance_at_date(acc_snaps, start_date)
                eb = cls._get_balance_at_date(acc_snaps, end_date)
                start_bal += sb * multiplier
                end_bal += eb * multiplier

        gain_loss = end_bal - start_bal
        return_pct = round((gain_loss / start_bal * 100.0), 2) if start_bal > 0 else 0.0

        # Target growth over days elapsed
        days_elapsed = max(1, (end_date - start_date).days)
        years_elapsed = days_elapsed / 365.25

        target_multiplier = (1.0 + (annual_target_rate / 100.0)) ** years_elapsed
        target_end_balance = start_bal * target_multiplier
        target_return_pct = round((target_multiplier - 1.0) * 100.0, 2)

        variance_dollars = round(end_bal - target_end_balance, 2)
        variance_pct = round(return_pct - target_return_pct, 2)
        ahead = variance_dollars >= 0

        # Annualized return
        annualized = round((((1.0 + (return_pct / 100.0)) ** (1.0 / max(years_elapsed, 0.08))) - 1.0) * 100.0, 2) if years_elapsed >= 1.0 and return_pct > -100.0 else None

        return TimeframePerformance(
            timeframe=timeframe_name,
            start_date=start_date.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d"),
            start_balance=round(start_bal, 2),
            end_balance=round(end_bal, 2),
            net_contributions=0.0,
            capital_gain_loss=round(gain_loss, 2),
            return_pct=return_pct,
            annualized_return_pct=annualized,
            target_return_pct=target_return_pct,
            target_end_balance=round(target_end_balance, 2),
            variance_dollars=variance_dollars,
            variance_pct=variance_pct,
            ahead_of_target=ahead
        )

    @classmethod
    def _generate_chart_series(
        cls,
        accounts: List[Account],
        snapshots: List[AccountSnapshot],
        start_date: datetime,
        end_date: datetime,
        annual_target_rate: float
    ) -> List[ChartPoint]:
        """Generate smooth daily/weekly chart points of actual balance vs compounded target balance."""
        days_total = max(1, (end_date - start_date).days)
        num_steps = min(60, days_total)
        step_days = max(1, days_total // num_steps)

        points = []
        start_bal = sum(
            cls._get_balance_at_date([s for s in snapshots if s.account_id == a.id], start_date) * (-1.0 if a.account_class == "liability" else 1.0)
            for a in accounts
        )
        base_bal = max(start_bal, 1.0)

        # Collect distinct categories and precompute start balances
        category_map = {}
        for a in accounts:
            cat = a.category_group or "Other"
            if cat not in category_map:
                category_map[cat] = []
            category_map[cat].append(a)

        cat_start_bals = {}
        for cat, cat_accs in category_map.items():
            cat_start_bals[cat] = sum(
                cls._get_balance_at_date([s for s in snapshots if s.account_id == a.id], start_date) * (-1.0 if a.account_class == "liability" else 1.0)
                for a in cat_accs
            )

        # Precompute per-account start balances
        acc_start_bals = {}
        for a in accounts:
            acc_start_bals[a.id] = cls._get_balance_at_date([s for s in snapshots if s.account_id == a.id], start_date) * (-1.0 if a.account_class == "liability" else 1.0)

        for i in range(num_steps + 1):
            curr_date = start_date + timedelta(days=i * step_days)
            if curr_date > end_date:
                curr_date = end_date

            # Category balance & return on curr_date
            cat_balances = {}
            cat_returns = {}
            # Account balance & return on curr_date
            acc_balances = {}
            acc_returns = {}
            actual_val = 0.0

            for cat, cat_accs in category_map.items():
                cat_val = sum(
                    cls._get_balance_at_date([s for s in snapshots if s.account_id == a.id], curr_date) * (-1.0 if a.account_class == "liability" else 1.0)
                    for a in cat_accs
                )
                actual_val += cat_val
                cat_balances[cat] = round(cat_val, 2)
                csb = cat_start_bals.get(cat, 0.0)
                if csb > 0:
                    cret = round(((cat_val - csb) / csb * 100.0), 2)
                else:
                    cret = 0.0
                cat_returns[cat] = cret

            for a in accounts:
                acc_val = cls._get_balance_at_date([s for s in snapshots if s.account_id == a.id], curr_date) * (-1.0 if a.account_class == "liability" else 1.0)
                acc_label = a.name
                acc_balances[acc_label] = round(acc_val, 2)
                asb = acc_start_bals.get(a.id, 0.0)
                if asb > 0:
                    aret = round(((acc_val - asb) / asb * 100.0), 2)
                else:
                    aret = 0.0
                acc_returns[acc_label] = aret

            actual_ret = round(((actual_val - start_bal) / base_bal * 100.0), 2)

            # Target compounded curve
            years = (curr_date - start_date).days / 365.25
            target_val = start_bal * ((1.0 + (annual_target_rate / 100.0)) ** years)
            target_ret = round(((target_val - start_bal) / base_bal * 100.0), 2)

            points.append(ChartPoint(
                date=curr_date.strftime("%Y-%m-%d"),
                actual_balance=round(actual_val, 2),
                actual_return_pct=actual_ret,
                target_balance=round(target_val, 2),
                target_return_pct=target_ret,
                category_balances=cat_balances,
                category_returns_pct=cat_returns,
                account_balances=acc_balances,
                account_returns_pct=acc_returns
            ))

        return points

    @staticmethod
    def _get_balance_at_date(snapshots: List[AccountSnapshot], target_date: datetime) -> float:
        """Find the snapshot balance active at or immediately preceding target_date."""
        if not snapshots:
            return 0.0

        candidates = [s for s in snapshots if s.snapshot_timestamp <= target_date]
        if candidates:
            return candidates[-1].current_balance
        # If target_date is before earliest recorded snapshot, use earliest
        return snapshots[0].current_balance

    @staticmethod
    def _score_to_tier(score: float) -> str:
        """Map numeric score (1.0 to 5.0) to 5-tier label."""
        if score < 1.8:
            return "Very Low"
        elif score < 2.6:
            return "Low"
        elif score < 3.6:
            return "Moderate"
        elif score < 4.4:
            return "High"
        else:
            return "Very High"

    @classmethod
    def _empty_performance_response(cls, account_filter: str, timeframe: str) -> PerformanceResponse:
        """Fallback empty response when no accounts exist."""
        timeframes = ["1M", "YTD", "1Y", "3Y", "5Y", "Lifetime"]
        metrics = {}
        now_str = datetime.utcnow().strftime("%Y-%m-%d")
        for tf in timeframes:
            metrics[tf] = TimeframePerformance(
                timeframe=tf,
                start_date=now_str,
                end_date=now_str,
                start_balance=0.0,
                end_balance=0.0,
                net_contributions=0.0,
                capital_gain_loss=0.0,
                return_pct=0.0,
                target_return_pct=0.0,
                target_end_balance=0.0,
                variance_dollars=0.0,
                variance_pct=0.0,
                ahead_of_target=True
            )
        return PerformanceResponse(
            account_filter=account_filter,
            timeframe=timeframe,
            timeframe_metrics=metrics,
            chart_series=[],
            account_breakdown=[]
        )


analytics_engine = AnalyticsEngine()
