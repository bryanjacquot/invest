# InvestTracker — Automated Frontend Testing Plan (Playwright + TypeScript)

This document defines the automated frontend testing strategy, architecture, test suites, and execution workflows for InvestTracker using **Playwright with TypeScript and Node.js**.

---

## 1. Quality Objectives & Scope

The automated frontend testing suite ensures end-to-end (E2E) correctness, UI regression prevention, and interaction reliability across all views and modals:

1. **Navigation & Clean Selection Highlights**: Validate single account selection, `Cmd`/`Ctrl` multi-account selection, "All Accounts" selection, and responsive mobile drawer behaviors.
2. **Dynamic Metric & Horizon Toggles**: Ensure metric toggling (`$` vs `%`) and timeframe switching (`1M` to `Lifetime`) update KPIs, charts, and tables without losing user context or state.
3. **Modal Dialog Workflows**: Validate form handling and API integrations for *Edit Account*, *Log Valuation / Payment*, *Add Account*, and *Database Backup & Settings*.
4. **Data Visualization Integrity**: Verify Chart.js canvas rendering, color assignments (green total line, peach target curve, distinct multi-account colors), and tooltip formatting.
5. **Cross-Browser & Responsive Validation**: Execute tests across Chromium, Firefox, and WebKit on desktop and mobile viewports.

---

## 2. Technology Stack & Framework Architecture

- **Test Runner & Automation Engine**: [Playwright Test](https://playwright.dev/) (`@playwright/test`)
- **Language**: TypeScript (`typescript`, `ts-node`)
- **Design Pattern**: Page Object Model (POM) for clean separation of UI selectors, actions, and assertions.
- **Reporting & Debugging**: Playwright HTML Reporter, trace viewer (`--trace on`), video recordings on failure, and interactive UI Mode (`npx playwright test --ui`).

### Directory Structure

```
specs/
└── FRONTEND_TEST_PLAN.md

frontend/ (or project root)
├── e2e/
│   ├── fixtures/
│   │   ├── auth.fixture.ts         # Pre-authenticated user sessions & token injection
│   │   └── mock-data.ts            # Deterministic portfolio and chart datasets
│   ├── page-objects/
│   │   ├── BasePage.ts             # Global layout, header, sync, and theme helpers
│   │   ├── SidebarComponent.ts     # Flat account list, All Accounts, multi-select highlights
│   │   ├── OverviewPage.ts         # Net worth KPI cards, asset progress bar, debt ratio
│   │   ├── AccountPage.ts          # Performance, $ / % toggle, horizon buttons, Chart/Table, Holdings
│   │   ├── RealEstatePage.ts       # Property cards, mortgage balances, equity calculations
│   │   └── Modals/
│   │       ├── AuthModal.ts        # Login & registration forms
│   │       ├── EditAccountModal.ts # Account name, category dropdown, target APR rate
│   │       ├── ValuationModal.ts   # Balance updates & mortgage payments
│   │       └── AddAccountModal.ts  # Manual asset & linked liability creation
│   ├── tests/
│   │   ├── 01_auth.spec.ts
│   │   ├── 02_sidebar_navigation.spec.ts
│   │   ├── 03_overview_view.spec.ts
│   │   ├── 04_account_performance.spec.ts
│   │   ├── 05_account_holdings.spec.ts
│   │   ├── 06_modals_and_actions.spec.ts
│   │   └── 07_real_estate.spec.ts
├── playwright.config.ts
├── package.json
└── tsconfig.json
```

---

## 3. Test Matrix & Detailed Scenarios

### Suite 1: Authentication & Session Lifecycle (`01_auth.spec.ts`)
| Test ID | Scenario | Actions | Assertions |
| :--- | :--- | :--- | :--- |
| **AUTH-01** | Initial unauthenticated state | Open root `/` without token | Auth modal is visible; protected views are inaccessible |
| **AUTH-02** | Invalid login attempt | Submit incorrect username/password | Displays error banner; modal remains open |
| **AUTH-03** | Valid login & session store | Submit valid credentials | JWT stored in `localStorage`; user menu displays username; Overview loads |
| **AUTH-04** | Logout workflow | Open user dropdown -> Click Sign Out | Token cleared from `localStorage`; auth modal reappears |

---

### Suite 2: Sidebar Navigation & Selection Highlights (`02_sidebar_navigation.spec.ts`)
| Test ID | Scenario | Actions | Assertions |
| :--- | :--- | :--- | :--- |
| **NAV-01** | Overview menu click | Click "Overview" nav item | URL updates to `/overview`; Overview menu item has `.active` highlight |
| **NAV-02** | Single account selection | Click an account in the flat list | URL updates to `/account?id=<id>`; account item has `.active` highlight; "All Accounts" is not highlighted |
| **NAV-03** | Multi-account selection (`Cmd`/`Ctrl` click) | `Cmd`+click 2 or more accounts | URL updates to `/account?accounts=id1,id2`; all selected accounts have `.active` highlights |
| **NAV-04** | "All Accounts" selection | Click "All Accounts" row | URL updates to `/account`; "All Accounts" has `.active` highlight; individual accounts lose highlight |
| **NAV-05** | Legacy URL redirect | Navigate directly to `/performance` | Route resolves to `/account` seamlessly without breaking |
| **NAV-06** | Mobile drawer toggle | Click hamburger toggle on viewport width < 1024px | Sidebar panel slides in; clicking backdrop dismisses sidebar |

---

### Suite 3: Overview Page (`03_overview_view.spec.ts`)
| Test ID | Scenario | Actions | Assertions |
| :--- | :--- | :--- | :--- |
| **OVR-01** | Net worth metrics rendering | Load `/overview` with demo portfolio | Displays Total Net Worth, Invested Assets, trailing period changes (1M, YTD, 1Y) |
| **OVR-02** | Asset allocation progress bar | Inspect category distribution bar | Segment widths and legend values match portfolio balances |
| **OVR-03** | Category card navigation | Click "Retirement" KPI card | Navigates to `/account` with Retirement accounts filtered |
| **OVR-04** | Real Estate card navigation | Click "Real Estate" KPI card | Navigates to `/real-estate` |

---

### Suite 4: Account & Performance Page (`04_account_performance.spec.ts`)
| Test ID | Scenario | Actions | Assertions |
| :--- | :--- | :--- | :--- |
| **ACC-01** | Single account header | Navigate to `/account?id=<id>` | Header displays account name, category pill, institution, subtype, balance, and "Edit Account" button |
| **ACC-02** | Multi-account portfolio header | Navigate to `/account?accounts=id1,id2` | Header displays "2 Accounts Selected", combined balance, and "+ Add Account" button |
| **ACC-03** | Metric Unit toggle (`%` vs `$`) | Click `$ Dollars` toggle button | Metric updates to `$`; 4 KPI cards convert to dollar gains; Target line updates to projected dollar growth; timeframe remains unchanged |
| **ACC-04** | Horizon switching | Click `3Y` button | URL updates `timeframe=3Y`; KPI cards, line chart, and matrix table update |
| **ACC-05** | Chart vs Table view toggle | Click `Table` toggle button | Line chart canvas container is hidden; Timeframe matrix table (`1M`, `YTD`, `1Y`, `3Y`, `5Y`, `Lifetime`) is displayed |
| **ACC-06** | Multi-account chart line colors | Multi-select 2 accounts on `/account` | Line chart renders Total line (green `#10b981`), Target curve (peach `#ff9052` dashed), and individual account series |

---

### Suite 5: Holdings & Asset Allocation (`05_account_holdings.spec.ts`)
| Test ID | Scenario | Actions | Assertions |
| :--- | :--- | :--- | :--- |
| **HLD-01** | Subtab switching | Click "Holdings & Allocation" tab | URL updates `tab=holdings`; donut chart and holdings table render |
| **HLD-02** | Risk rating badge | Inspect risk score | Displays blended risk tier (e.g., "Moderate Risk (3.2)") matching portfolio composition |
| **HLD-03** | Holdings search filter | Type search query (e.g. "AAPL" or "VTI") | Table filters instantly; only matching tickers/names are displayed |
| **HLD-04** | Empty holdings handling | View account with zero holdings | Displays clean empty state message without rendering errors |

---

### Suite 6: Modals & Data Modifications (`06_modals_and_actions.spec.ts`)
| Test ID | Scenario | Actions | Assertions |
| :--- | :--- | :--- | :--- |
| **MOD-01** | Edit Account dialog | Click "Edit Account" button in account header | Modal opens; pre-populates name, category group, and target APR rate; submitting `PUT /api/accounts/{id}` updates balance card and table |
| **MOD-02** | Valuation / Payment dialog | Click "+ Log Valuation / Payment" | Submitting new balance logs historical snapshot; chart re-renders with new valuation point |
| **MOD-03** | Add Manual Account | Click "+ Add Account" in sidebar footer | Selects manual asset type; validates required fields; newly added account appears in sidebar flat list |
| **MOD-04** | Settings & Backup modal | Open User menu -> Database & Backup | Modal displays SQLite database size and snapshot counts; clicking "Download Backup" triggers `.sqlite` file download |

---

## 4. Playwright Configuration (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3010',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] }
    }
  ],
  webServer: {
    command: 'cd .. && ./run_local.sh',
    url: 'http://localhost:3010',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
```

---

## 5. Setup & Execution Workflows

### Setup Prerequisites
```bash
# 1. Initialize Node project in /e2e or root
npm init -y

# 2. Install Playwright & TypeScript dependencies
npm install -D @playwright/test typescript @types/node

# 3. Install browser binaries
npx playwright install --with-deps
```

### Execution Commands
- **Run all E2E tests headless**:
  ```bash
  npx playwright test
  ```
- **Run interactive UI Mode (recommended for local development)**:
  ```bash
  npx playwright test --ui
  ```
- **Run specific test suite**:
  ```bash
  npx playwright test e2e/tests/04_account_performance.spec.ts
  ```
- **Run in headed browser with step-by-step debug**:
  ```bash
  npx playwright test --headed --debug
  ```
- **View HTML execution report**:
  ```bash
  npx playwright show-report
  ```

---

## 6. Continuous Integration (CI) Strategy

1. **GitHub Actions Workflow (`.github/workflows/frontend-e2e.yml`)**:
   - Spawns backend service with test SQLite database and seeds demo portfolio.
   - Serves frontend at `http://localhost:3010`.
   - Runs `npx playwright test` across Chromium, Firefox, and WebKit.
   - Archives Playwright HTML report and traces on test failure for rapid triage.
