# InvestTracker — Self-Hosted Investment & Net Worth Tracker

A self-hosted personal finance intelligence system running in Docker containers on Synology NAS. Tracks investment performance, net worth, actual vs. target return rates, granular product holdings, 5-tier risk profiles, real estate equity, and linked mortgages.

---

## Architecture & Topology

- **`invest-frontend` (Port 3010):** Nginx container serving a responsive, glassmorphic dark UI and reverse proxying `/api` requests internally.
- **`invest-api` (Port 3011):** High-performance Python (FastAPI) calculation engine and REST API.
- **Persistence Layer:** SQLite database in Write-Ahead Logging (WAL) mode mounted to persistent host storage (`/volume1/docker/invest/data`).
- **Synology Reverse Proxy:** Maps `https://invest.local:443` -> `http://localhost:3010`.

---

## Features

1. **Net Worth & Balance Sheet:** Real-time summary and multi-year historical tracking combining liquid investments, emergency reserves, real estate, and liabilities.
2. **Multi-Timeframe Performance Analytics:** TWR return calculations for `1M`, `YTD`, `1Y`, `3Y`, `5Y`, and `Lifetime` intervals in both interactive line chart and comparative table formats.
3. **Multi-Account & Category Filtering:** Instant toggle filtering for *All Accounts (Blended)*, *Retirement*, *Taxable Brokerage*, *Emergency Savings*, *Real Estate*, *Debt & Loans*, or single accounts.
4. **Target Return Rate Comparison:** Compares actual performance against compounded target annual rates per account with ahead/behind metrics.
5. **Granular Holdings Breakdown:** Product and ticker-level analysis with cost basis, gains, share quantities, and portfolio weight %.
6. **5-Tier Risk Profile Engine:** Evaluates asset allocation exposure and assigns risk scores (*Very Low, Low, Moderate, High, Very High*) across accounts and the blended portfolio.
7. **Real Estate & Mortgage Equity:** Links mortgages to properties with automatic **Net Property Equity** and **Loan-to-Value (LTV)** tracking.
8. **On-Demand Synchronization:** User-initiated sync updates; no automated background polling.
9. **One-Click SQLite Backup & Restore:** Direct `.sqlite` snapshot download and verified restore.
10. **Secure Authentication:** Username & salted password hashing using `bcrypt` and JWT session tokens.

---

## Quick Start (Local Development)

### 1. Single Command Dev Server (No Docker required)
```bash
./run_local.sh
```
This launches:
- **Web App:** [http://localhost:3010](http://localhost:3010)
- **FastAPI Backend:** [http://localhost:3011](http://localhost:3011)

### 2. Run with Docker Compose
```bash
cp .env.example .env
docker compose up --build -d
```
Access the application at [http://localhost:3010](http://localhost:3010).

### 3. Run Backend Automated Tests
```bash
./venv/bin/pytest --cov=app --cov-report=term-missing backend/tests
```

---

## Synology NAS Deployment (`https://invest.local`)

### 1. Copy Files to Synology
Place the repository files into `/volume1/docker/invest/` on your Synology NAS.

### 2. Create Persistent Data Folder
```bash
mkdir -p /volume1/docker/invest/data/backups
chmod -R 775 /volume1/docker/invest/data
```

### 3. Launch via Synology Container Manager
Run in terminal or Synology Container Manager Project:
```bash
docker compose -f /volume1/docker/invest/docker-compose.yml up -d
```

### 4. Configure Synology Reverse Proxy / Web Station
1. Open **DSM Control Panel** -> **Login Portal** -> **Advanced** -> **Reverse Proxy**.
2. Click **Create**:
   - **General:**
     - Reverse Proxy Name: `InvestTracker`
     - **Source:**
       - Protocol: `HTTPS`
       - Hostname: `invest.local`
       - Port: `443`
       - Enable HSTS & HTTP/2
     - **Destination:**
       - Protocol: `HTTP`
       - Hostname: `localhost` (or NAS Local IP)
       - Port: `3010`
   - **Custom Header:** Add WebSocket upgrade headers (`Upgrade: $http_upgrade`, `Connection: $connection_upgrade`).
3. Attach your SSL certificate under **Control Panel** -> **Security** -> **Certificate** for `invest.local`.
4. Access your portal at **`https://invest.local`**.
