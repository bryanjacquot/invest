import { test as base, Page, request } from '@playwright/test';

export interface AuthContext {
  page: Page;
  seedDemo: () => Promise<void>;
}

export async function getAuthToken() {
  const username = `e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const password = 'Password123!';
  const reqContext = await request.newContext();
  let token = '';

  try {
    const regRes = await reqContext.post('http://localhost:3011/api/auth/register', {
      data: { username, password }
    });
    if (regRes.ok()) {
      const data = await regRes.json();
      token = data.access_token;
    } else {
      const loginRes = await reqContext.post('http://localhost:3011/api/auth/login', {
        data: { username, password }
      });
      if (loginRes.ok()) {
        const data = await loginRes.json();
        token = data.access_token;
      }
    }
  } catch (err) {
    console.error('Error obtaining auth token:', err);
  } finally {
    await reqContext.dispose();
  }

  return token;
}

export async function seedDemoData(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('invest_token'));
  if (token) {
    const reqContext = await request.newContext();
    await reqContext.post('http://localhost:3011/api/seed/demo-portfolio', {
      headers: { Authorization: `Bearer ${token}` }
    });
    await reqContext.dispose();
  }
}

export const test = base.extend<AuthContext>({
  page: async ({ page }, use) => {
    const token = await getAuthToken();
    if (token) {
      // 1. Check if user already has accounts seeded
      const reqContext = await request.newContext();
      const accsRes = await reqContext.get('http://localhost:3011/api/accounts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const accs = accsRes.ok() ? await accsRes.json() : [];

      if (!accs || accs.length === 0) {
        await reqContext.post('http://localhost:3011/api/seed/demo-portfolio', {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await reqContext.dispose();

      // 2. Inject token into localStorage for all pages
      await page.addInitScript((tok) => {
        window.localStorage.setItem('invest_token', tok);
      }, token);
    }
    await page.goto('/overview');
    await page.locator('#sidebar-accounts-list .sidebar-account-item').first().waitFor({ state: 'visible', timeout: 10000 });
    await use(page);
  }
});

export { expect } from '@playwright/test';
