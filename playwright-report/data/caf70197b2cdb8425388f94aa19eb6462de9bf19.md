# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 06_modals.spec.ts >> Suite 6: Modals & Actions >> MOD-05: Plaid tab displays configuration status via environment and contains no secret inputs
- Location: e2e/tests/06_modals.spec.ts:170:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3010/account
Call log:
  - navigating to "http://localhost:3010/account", waiting until "load"

```

# Test source

```ts
  1  | import { test as base, Page, request } from '@playwright/test';
  2  | 
  3  | export interface AuthContext {
  4  |   page: Page;
  5  |   seedDemo: () => Promise<void>;
  6  | }
  7  | 
  8  | export async function getAuthToken() {
  9  |   const username = `e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  10 |   const password = 'Password123!';
  11 |   const reqContext = await request.newContext();
  12 |   let token = '';
  13 | 
  14 |   try {
  15 |     const regRes = await reqContext.post('http://localhost:3011/api/auth/register', {
  16 |       data: { username, password }
  17 |     });
  18 |     if (regRes.ok()) {
  19 |       const data = await regRes.json();
  20 |       token = data.access_token;
  21 |     } else {
  22 |       const loginRes = await reqContext.post('http://localhost:3011/api/auth/login', {
  23 |         data: { username, password }
  24 |       });
  25 |       if (loginRes.ok()) {
  26 |         const data = await loginRes.json();
  27 |         token = data.access_token;
  28 |       }
  29 |     }
  30 |   } catch (err) {
  31 |     console.error('Error obtaining auth token:', err);
  32 |   } finally {
  33 |     await reqContext.dispose();
  34 |   }
  35 | 
  36 |   return token;
  37 | }
  38 | 
  39 | export async function seedDemoData(page: Page) {
  40 |   const token = await page.evaluate(() => localStorage.getItem('invest_token'));
  41 |   if (token) {
  42 |     const reqContext = await request.newContext();
  43 |     await reqContext.post('http://localhost:3011/api/seed/demo-portfolio', {
  44 |       headers: { Authorization: `Bearer ${token}` }
  45 |     });
  46 |     await reqContext.dispose();
  47 |   }
  48 | }
  49 | 
  50 | export const test = base.extend<AuthContext>({
  51 |   page: async ({ page }, use) => {
  52 |     const token = await getAuthToken();
  53 |     if (token) {
  54 |       // 1. Check if user already has accounts seeded
  55 |       const reqContext = await request.newContext();
  56 |       const accsRes = await reqContext.get('http://localhost:3011/api/accounts', {
  57 |         headers: { Authorization: `Bearer ${token}` }
  58 |       });
  59 |       const accs = accsRes.ok() ? await accsRes.json() : [];
  60 | 
  61 |       if (!accs || accs.length === 0) {
  62 |         await reqContext.post('http://localhost:3011/api/seed/demo-portfolio', {
  63 |           headers: { Authorization: `Bearer ${token}` }
  64 |         });
  65 |       }
  66 |       await reqContext.dispose();
  67 | 
  68 |       // 2. Inject token into localStorage for all pages
  69 |       await page.addInitScript((tok) => {
  70 |         window.localStorage.setItem('invest_token', tok);
  71 |       }, token);
  72 |     }
> 73 |     await page.goto('/account');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3010/account
  74 |     await page.locator('#sidebar-accounts-list .sidebar-account-item').first().waitFor({ state: 'visible', timeout: 10000 });
  75 |     await use(page);
  76 |   }
  77 | });
  78 | 
  79 | export { expect } from '@playwright/test';
  80 | 
```