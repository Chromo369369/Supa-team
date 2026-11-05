import { test, expect } from '@playwright/test';

// group tests
test('host crew', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('test7@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL('http://localhost:3000/home', { timeout: 15000 });

  await page.goto('http://localhost:3000/group');
  await page.getByRole('button', { name: 'Host a crew', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Crew lobby', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy code', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Leave crew', exact: true }).click();
  await page.getByRole('button', { name: 'End crew', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Host a crew', exact: true })).toBeEnabled();
});


// all join crew tests
// gt acc
test('join crew', async ({ page }) => {
  const crewCode = '549013'; // hostcrew acc forever host a crew so that the code can be used to test

  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('gt1@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL('http://localhost:3000/home', { timeout: 15000 });

  await page.goto('http://localhost:3000/group');
  await page.getByRole('textbox', { name: 'Crew code', exact: true }).fill(crewCode);
  await page.getByRole('button', { name: 'Join crew', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Crew lobby', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy code', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Leave crew', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Leave crew', exact: true }).click();

  await expect(page.getByRole('textbox', { name: 'Crew code', exact: true })).toBeEnabled();
});

test('empty crew code when joining', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('gt2@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL('http://localhost:3000/home', { timeout: 15000 });

  await page.goto('http://localhost:3000/group');

  const crewCode = page.getByRole('textbox', { name: 'Crew code', exact: true });
  await crewCode.fill('');
  await page.getByRole('button', { name: 'Join crew', exact: true }).click();
  await expect(page.getByText('Enter the 6-digit crew code.', { exact: true })).toBeVisible();
  await expect(crewCode).toHaveValue('');
  await expect(crewCode).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL('http://localhost:3000/group');
});

test('code <= 6 digits when joining', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('gt3@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL('http://localhost:3000/home', { timeout: 15000 });

  await page.goto('http://localhost:3000/group');

  const crewCode = page.getByRole('textbox', { name: 'Crew code', exact: true });
  await crewCode.fill('12345');
  await page.getByRole('button', { name: 'Join crew', exact: true }).click();

  await expect(page.getByText('Enter the 6-digit crew code.', { exact: true })).toBeVisible();
  await expect(crewCode).toHaveValue('12345');
  await expect(crewCode).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL('http://localhost:3000/group');
});

test('wrong crew code when joining', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('gt4@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL('http://localhost:3000/home', { timeout: 15000 });

  await page.goto('http://localhost:3000/group');

  const crewCode = page.getByRole('textbox', { name: 'Crew code', exact: true });
  await crewCode.fill('999999');
  await page.getByRole('button', { name: 'Join crew', exact: true }).click();

  await expect(page.getByText('That code doesn’t exist. Check it and try again.', { exact: true })).toBeVisible();
  await expect(crewCode).toHaveValue('999999');
  await expect(crewCode).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL('http://localhost:3000/group');
  await expect(page.getByRole('heading', { name: 'Crew lobby', exact: true })).not.toBeVisible();
});


// leave crew tests
// lg acc
test('leave crew', async ({ page }) => {
  const crewCode = '549013';

  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('lg@gmail.com'); 
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL('http://localhost:3000/home', { timeout: 15000 });

  await page.goto('http://localhost:3000/group');
  await page.getByRole('textbox', { name: 'Crew code', exact: true }).fill(crewCode);
  await page.getByRole('button', { name: 'Join crew', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Crew lobby', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Leave crew', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Leave crew', exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crew lobby', exact: true })).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Crew code', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Host a crew', exact: true })).toBeEnabled();
});


test('cancel leave crew', async ({ page }) => {
  const crewCode = '549013';

  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('lg2@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL('http://localhost:3000/home', { timeout: 15000 });

  await page.goto('http://localhost:3000/group');
  await page.getByRole('textbox', { name: 'Crew code', exact: true }).fill(crewCode);
  await page.getByRole('button', { name: 'Join crew', exact: true }).click();

  const lobby = page.getByRole('heading', { name: 'Crew lobby', exact: true });
  await expect(lobby).toBeVisible();

  await page.getByRole('button', { name: 'Leave crew', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(lobby).toBeVisible();

  await page.reload();
  await expect(lobby).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy code', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Leave crew', exact: true }).click();
  await dialog.getByRole('button', { name: 'Leave crew', exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Crew code', exact: true })).toBeEnabled();
});

test('host leave crew', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('lg3@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL('http://localhost:3000/home', { timeout: 15000 });

  await page.goto('http://localhost:3000/group');
  await page.getByRole('button', { name: 'Host a crew', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Crew lobby', exact: true })).toBeVisible();

  const crewLabel = page.getByText(/^Crew \d{6}$/);
  await expect(crewLabel).toBeVisible();
  const crewCode = (await crewLabel.innerText()).match(/\d{6}/)![0];

  await page.getByRole('button', { name: 'Leave crew', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'End crew', exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Crew code', exact: true })).toBeEnabled();

  await page.reload();
  await page.getByRole('textbox', { name: 'Crew code', exact: true }).fill(crewCode);
  await page.getByRole('button', { name: 'Join crew', exact: true }).click();

  await expect(
    page.getByText('That code doesn’t exist. Check it and try again.', { exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crew lobby', exact: true })).not.toBeVisible();
});

