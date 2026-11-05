import path from 'node:path';

export const e2eEmail = process.env.E2E_EMAIL ?? process.env.E2E_TEST_EMAIL;
export const e2ePassword = process.env.E2E_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
export const hasE2EAccount = Boolean(e2eEmail && e2ePassword);
export const authFile = path.join(process.cwd(), 'playwright', '.auth', 'user.json');
export const emptyAuthState = { cookies: [], origins: [] };

export function requireE2EAccount(): { email: string; password: string } {
  if (!e2eEmail || !e2ePassword) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD in .env to run authenticated browser tests.');
  }

  return { email: e2eEmail, password: e2ePassword };
}
