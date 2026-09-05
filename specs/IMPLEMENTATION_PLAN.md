# Implementation Plan: Investment Tracking Application

We will build the complete, production-ready Investment Tracking Application based on [specs/DESIGN.md](file:///Users/bryanjacquot/Source/invest/specs/DESIGN.md). The application will feature a Python (FastAPI) backend, SQLite database with WAL mode, a modern glassmorphic web frontend, Plaid integration, manual asset/loan management (with real estate equity tracking), multi-timeframe performance analytics (1M, YTD, 1Y, 3Y, 5Y, Lifetime), target return rate comparison, 5-tier risk analysis, one-click SQLite backup/restore, an automated testing suite targeting $\ge 95\%$ function and $\ge 90\%$ line coverage, and a dual-container Docker setup for Synology NAS at `https://invest.local`.

---

## User Review Required

> [!IMPORTANT]
> - **Test Coverage Targets & Automated Test Suite:**
>   - **Targets:** $\ge 95\%$ function coverage and $\ge 90\%$ line coverage across the core backend modules (`auth.py`, `models.py`, `schemas.py`, `manual_asset_service.py`, `analytics.py`, `plaid_service.py`, `seed.py`, `main.py`).
>   - **Explicit Exclusions:**
>     1. `backup.py` binary database stream swapping / active SQLite file replacement during runtime (tested via unit smoke-test for file generation, but live hot-swap restore excluded from automated coverage due to in-memory/file test runner SQLite locks).
>     2. Live external Plaid API HTTP calls to third-party banking servers (mocked using deterministic test fixtures and mock Plaid clients).
> - **Emergency Savings Support:** Fully integrated as a first-class user-settable account category and quick-filter toggle in the multi-account filter bar.
> - **Plaid Credentials & Offline/Sandbox Mode:** The backend supports live Plaid credentials (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`) as well as offline/sandbox demo seeding for immediate testing.
> - **Ports & Reverse Proxy:** Frontend serves on port **`3010`** and backend on port **`3011`**. Synology Reverse Proxy maps `https://invest.local:443` -> `http://localhost:3010`.

---

## Proposed Architecture & File Structure

```
invest/
├── docker-compose.yml              # Dual-container orchestration (invest-frontend:3010, invest-api:3011)
├── .env.example                    # Environment variable template
├── README.md                       # Synology NAS & local deployment guide
├── specs/
│   ├── DESIGN.md                   # Approved system design specification
│   └── IMPLEMENTATION_PLAN.md      # Approved implementation and test plan
├── backend/
│   ├── Dockerfile                  # Python 3.11 slim container definition
│   ├── requirements.txt            # FastAPI, Uvicorn, SQLAlchemy, Pydantic, Plaid-python, Bcrypt, PyJWT, Cryptography, Pytest, Pytest-cov, HTTPX
│   ├── pytest.ini                  # Pytest configuration with coverage flags
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI application, CORS, routers, error handling
│   │   ├── config.py               # Environment configuration and security keys
│   │   ├── database.py             # SQLite engine (WAL mode), session manager, Base model
│   │   ├── models.py               # SQLAlchemy ORM models (User, Institution, Account, ManualDetail, etc.)
│   │   ├── schemas.py              # Pydantic validation & response schemas
│   │   ├── auth.py                 # Password hashing (bcrypt), JWT tokens, auth dependencies
│   │   ├── plaid_service.py        # Plaid SDK client, token encryption, sync & historical data fetch
│   │   ├── manual_asset_service.py # Real estate, loans, asset-loan linking, valuation logs, equity
│   │   ├── analytics.py            # TWR engine, 1M/YTD/1Y/3Y/5Y/Lifetime returns, target curves, risk rating
│   │   ├── backup.py               # Database backup download & upload restore service
│   │   └── seed.py                 # Realistic demo data seeder (accounts, holdings, history, real estate)
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py             # Test database fixture, mock users, auth headers, and client
│       ├── test_auth.py            # User registration, login, JWT verification, duplicate handling
│       ├── test_accounts.py        # Account listing, categorizations (Emergency Savings, etc.), target updates
│       ├── test_manual_assets.py   # Real estate, loans, asset-to-loan linking, valuation logs, equity/LTV math
│       ├── test_analytics.py       # TWR, 1M/YTD/1Y/3Y/5Y/Lifetime filters, blended returns, target curves, 5-tier risk
│       ├── test_plaid_service.py   # Mock Plaid sync, link token creation, token encryption/decryption
│       └── test_seed.py            # Demo portfolio seeding and data integrity checks
└── frontend/
    ├── Dockerfile                  # Nginx static server + reverse proxy to backend
    ├── nginx.conf                  # Nginx configuration (port 3010, proxies /api -> invest-api:3011)
    └── src/
        ├── index.html              # Modern single-page app layout with glassmorphic cards and charts
        ├── styles.css              # Bespoke dark-mode styling, glowing accents, responsive grid
        └── app.js                  # Frontend state management, Chart.js integrations, API client, Plaid Link
```

---

## Detailed Component Plan

### 1. Backend Data Layer & Authentication (`backend/app/`)
- **`database.py` & `models.py`:**
  - `User`: `id`, `username`, `password_hash`, `created_at`, `last_login_at`
  - `Institution`: `id`, `user_id`, `name`, `plaid_item_id`, `plaid_access_token_encrypted`, `is_manual`
  - `Account`: `id`, `user_id`, `institution_id`, `linked_asset_id` (for mortgages/loans), `source_type` (`plaid`/`manual`), `account_class` (`asset`/`liability`), `name`, `type`, `subtype`, `category_group` (`Retirement`, `Taxable Brokerage`, `Emergency Savings`, `Real Estate`, `Debt`, `Other`), `currency`, `is_active`
  - `ManualAccountDetail`: `account_id`, `property_address`, `purchase_date`, `purchase_price`, `interest_rate`, `monthly_payment`, `maturity_date`, `notes`
  - `TargetConfig`: `account_id`, `target_annual_return_rate`, `notes`
  - `AccountSnapshot`: `id`, `account_id`, `snapshot_timestamp`, `current_balance`, `available_balance`, `cost_basis_total`, `market_value_total`, `note`
  - `Holding`: `id`, `account_id`, `ticker_symbol`, `name`, `asset_type`, `quantity`, `institution_price`, `institution_value`, `cost_basis`, `risk_tier`, `risk_score`, `as_of_date`
  - `Transaction`: `id`, `account_id`, `plaid_transaction_id`, `date`, `name`, `amount`, `transaction_type`
- **`auth.py`:**
  - Salted `bcrypt` hashing, JWT token creation/verification, `get_current_active_user` FastAPI dependency.
  - Endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.

### 2. Services & Calculation Engine (`backend/app/`)
- **`plaid_service.py`:**
  - Create Link Token (`/api/plaid/create_link_token`), exchange public token (`/api/plaid/exchange_public_token`), on-demand sync (`POST /api/plaid/sync`), fetching investments, holdings, balances, and historical transactions.
  - AES-256 token encryption with fallback when keys are not configured.
- **`manual_asset_service.py`:**
  - Endpoints: `POST /api/manual/accounts`, `GET /api/manual/accounts`, `POST /api/manual/valuations` (log new valuation/payment), `POST /api/manual/link-loan`.
  - Computes property equity, loan-to-value (LTV), and amortized balances.
- **`analytics.py`:**
  - **Net Worth Timeline:** Aggregated balance sheet over time (Liquid + Real Estate/Manual Assets - Loans).
  - **Performance Engine (TWR & Nominal Return):** Computes percentage return and nominal dollar growth across `1M`, `YTD`, `1Y`, `3Y`, `5Y`, and `Lifetime`.
  - **Target Return Comparison:** Compares actual portfolio return trajectory against compounded annual target rates ($ and % variance).
  - **Risk Profiling (5-Tier):** Assigns risk scores (`Very Low` to `Very High`) per holding and computes weighted account & portfolio ratings.
  - **Holdings Breakdown:** Aggregated and per-account holding tables with allocation %, gains, and risk tags.
- **`backup.py`:**
  - `GET /api/backup/download`: Streams current SQLite database as a timestamped download.
  - `POST /api/backup/restore`: Accepts uploaded `.sqlite` file, validates integrity, replaces active DB.

### 3. Frontend Web Application (`frontend/`)
- **Design System & Aesthetics:**
  - Modern dark-mode palette with glassmorphism cards, subtle neon teal/blue accents, clean typography (Inter / Outfit), crisp stat badges.
  - Single-page architecture with dynamic tab views: **Dashboard / Net Worth**, **Performance & Target Comparison**, **Holdings & Allocation**, **Real Estate & Loans**, and **Settings & Backup**.
- **Interactive UI Capabilities:**
  - **Top Navigation & Auth Header:** User profile, sync status indicator, prominent **"⚡ Sync Now"** button, and Logout.
  - **Multi-Account Filter Bar:** Instant toggle buttons for *All Accounts (Blended)*, *Retirement*, *Taxable Brokerage*, *Emergency Savings*, *Real Estate*, *Liabilities*, or individual accounts.
  - **Account Categorization & Settings:** Allows the user to configure or re-assign any account's category group (e.g., set to *Emergency Savings*, *Retirement*, *Taxable Brokerage*, *Real Estate*, *Debt / Loans*).
  - **Performance Timeframe Selector:** Quick toggle between `1M`, `YTD`, `1Y`, `3Y`, `5Y`, and `Lifetime`.
  - **View Switcher:** Toggle between interactive line charts and detailed performance breakdown tables.
  - **Target Comparison Card & Chart:** Visual overlay comparing actual return curve vs. compounded target return curve with ahead/behind metrics.
  - **Holdings & Allocation Donut:** Interactive asset breakdown (Equities, Bonds, Real Estate, Cash, Alternatives, Debt) + searchable holding table.
  - **Real Estate & Loan Cards:** Property valuation cards displaying linked mortgage, equity progress bar, and LTV ratio.
  - **Modal Dialogs:**
    - Add Institution / Plaid Link Modal
    - Add Manual Asset / Real Estate Modal
    - Add Loan / Mortgage Modal (with property link dropdown)
    - Log Valuation / Loan Payment Modal
    - Target Return Rate inline editor
    - Database Backup & Restore Modal

### 4. Docker & Synology NAS Integration
- **`docker-compose.yml`:** Dual service definitions (`invest-frontend` on port 3010, `invest-api` on port 3011) with persistent data volume mounted to `/data` (`/volume1/docker/invest/data`).
- **`nginx.conf`:** Frontend proxy configuration routing `/api/*` to `invest-api:3011`.
- **`README.md`:** Comprehensive instructions for setup, environment configuration, local development, and Synology DSM Web Station / Reverse Proxy (`https://invest.local`).

---

## Automated Testing Plan & Coverage Metrics

### Test Suite Specifications
1. **`test_auth.py`:**
   - Registration with valid/invalid credentials, password hashing verification with bcrypt, token generation and decoding, duplicate username conflict handling (400/409), unauthorized access protections (401).
2. **`test_accounts.py`:**
   - Account listing scoped to user, account creation, categorization as `Emergency Savings`, `Retirement`, `Taxable Brokerage`, `Real Estate`, `Debt`, updating target return rates, active/inactive toggles.
3. **`test_manual_assets.py`:**
   - Real estate property creation, mortgage creation, linking mortgage to property, property net equity calculation ($\text{Market Value} - \text{Loan Balance}$), LTV percentage math, manual valuation logs, and loan payment logs.
4. **`test_analytics.py`:**
   - Time-Weighted Return (TWR) calculations across intervals (`1M`, `YTD`, `1Y`, `3Y`, `5Y`, `Lifetime`), nominal dollar gain calculations, multi-account blended aggregation, actual vs. target compounded projection variance, 5-tier risk profile weighting.
5. **`test_plaid_service.py`:**
   - AES-256 token encryption and decryption, mock link token generation, mock public token exchange, mock sync of holdings, transactions, and balances.
6. **`test_seed.py`:**
   - Demo portfolio seeding execution, validation of generated institutions, accounts, snapshots, and target return configs.

### Coverage Targets & Exclusions
- **Line Coverage Target:** $\ge 90\%$ across tested application modules (`backend/app/auth.py`, `models.py`, `schemas.py`, `manual_asset_service.py`, `analytics.py`, `plaid_service.py`, `seed.py`, `main.py`).
- **Function Coverage Target:** $\ge 95\%$ across tested application functions.
- **Explicit Exclusions:**
  1. `backup.py` hot-swap live database file replacement (due to active SQLite engine locks during in-process test execution).
  2. Direct third-party Plaid live network requests (external banking servers mocked in tests).

### Verification Commands
```bash
# Run pytest with line and branch coverage report
pytest --cov=app --cov-report=term-missing --cov-report=html backend/tests
```
