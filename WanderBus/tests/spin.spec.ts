import { expect, test } from '@playwright/test';
import { hasE2EAccount } from './fixtures/auth';
import { mockBrowserThirdParties } from './fixtures/external';
import { createE2EContext } from './fixtures/supabase';

const runTag = 'e2e-' + Date.now();

test.skip(!hasE2EAccount, 'Set E2E_EMAIL and E2E_PASSWORD for the authenticated spin case.');

test('restores the time and category filters from a shared spin URL', async ({ page }) => {
  await page.goto('/home?mins=45&cats=cafe,park');
  await expect(page.getByRole('heading', { name: 'Spin a side quest' })).toBeVisible();
  await expect(page.getByLabel('How long do you have?')).toHaveValue('45');
  await expect(page.getByLabel('Cafés')).toBeChecked();
  await expect(page.getByLabel('Parks')).toBeChecked();
});

test('spins, saves the revealed trip, and opens its stop page', async ({ page }) => {
  const e2e = await createE2EContext();
  let spinMayHaveSaved = false;
  const { data: existingEntries, error: entriesError } = await e2e.client
    .from('passport_entries').select('id').eq('user_id', e2e.userId);
  if (entriesError) {
    await e2e.dispose();
    throw entriesError;
  }
  const existingEntryIds = new Set((existingEntries ?? []).map(entry => String(entry.id)));

  try {
    const { data: existingSpin, error } = await e2e.client
      .from('soloTrip').select('user_id').eq('user_id', e2e.userId).maybeSingle();
    if (error && error.code !== 'PGRST205' && error.code !== '42P01') throw error;
    test.skip(Boolean(existingSpin), 'Use a clean E2E user with no saved solo spin.');

    await mockBrowserThirdParties(page);
    await page.goto('/home?mins=60');
    const location = page.getByLabel('Starting location');
    await location.fill('E2E test');
    await page.getByRole('option', { name: 'E2E TEST LOCATION, SINGAPORE' }).click();

    await page.getByRole('button', { name: 'Spin', exact: true }).click();
    spinMayHaveSaved = true;
    await expect(page.getByRole('status').filter({ hasText: 'mystery tickets are riding the belt' })).toBeVisible();
    const ticket = page.getByRole('button', { name: /Ticket A, about \d+ min/ });
    await expect(ticket).toBeVisible();
    await ticket.click();
    await page.getByRole('button', { name: 'Tear the stub to reveal your bus' }).click();
    await expect(page.getByRole('heading', { name: 'Your side quest' })).toBeVisible();

    await page.getByRole('button', { name: 'Save to passport' }).click();
    await expect(page.getByText('Saved to your passport')).toBeVisible();
    const { data: createdEntries, error: createdEntriesError } = await e2e.client
      .from('passport_entries').select('id').eq('user_id', e2e.userId);
    if (createdEntriesError) throw createdEntriesError;
    const createdEntry = (createdEntries ?? []).find(entry => !existingEntryIds.has(String(entry.id)));
    if (!createdEntry) throw new Error('The spin did not create a new passport entry.');
    const { error: entryTagError } = await e2e.client.from('passport_entries')
      .update({ entry_notes: `${e2e.runTag} saved spin fixture` }).eq('id', createdEntry.id);
    if (entryTagError) throw entryTagError;

    const { data: savedSpin, error: readError } = await e2e.client
      .from('soloTrip').select('current_trip').eq('user_id', e2e.userId).maybeSingle();
    if (readError) throw readError;
    if (savedSpin?.current_trip) {
      const { error: tagError } = await e2e.client.from('soloTrip').update({
        current_trip: { ...savedSpin.current_trip, __e2eRunTag: runTag },
      }).eq('user_id', e2e.userId);
      if (tagError) throw tagError;
    }

    await page.getByRole('link', { name: 'Explore this stop' }).click();
    await expect(page.getByRole('heading', { name: 'Around this stop' })).toBeVisible();
    await expect(page.getByText('E2E Test Stop')).toBeVisible();
  } finally {
    try {
      const { data: currentEntries, error: entryReadError } = await e2e.client
        .from('passport_entries').select('id, entry_notes').eq('user_id', e2e.userId);
      if (entryReadError) throw entryReadError;
      for (const entry of currentEntries ?? []) {
        if (!existingEntryIds.has(String(entry.id)) && !entry.entry_notes?.includes(e2e.runTag)) {
          const { error: entryTagError } = await e2e.client.from('passport_entries')
            .update({ entry_notes: `${e2e.runTag} saved spin fixture` }).eq('id', entry.id);
          if (entryTagError) throw entryTagError;
        }
      }

      if (spinMayHaveSaved) {
        const { data: savedSpin, error: cleanupReadError } = await e2e.client
          .from('soloTrip').select('current_trip').eq('user_id', e2e.userId).maybeSingle();
        if (cleanupReadError) throw cleanupReadError;
        if (savedSpin?.current_trip) {
          if (savedSpin.current_trip.__e2eRunTag !== runTag) {
            const { error: tagError } = await e2e.client.from('soloTrip').update({
              current_trip: { ...savedSpin.current_trip, __e2eRunTag: runTag },
            }).eq('user_id', e2e.userId);
            if (tagError) throw tagError;
          }
          const { data: deleted, error: deleteError } = await e2e.client.from('soloTrip').delete().eq('user_id', e2e.userId)
            .contains('current_trip', { __e2eRunTag: runTag }).select('user_id');
          if (deleteError) throw deleteError;
          if (!deleted?.length) throw new Error(`Could not clean up the tagged solo spin ${runTag}.`);
        }
      }
    } finally {
      await e2e.dispose();
    }
  }
});

test('mobile dock opens the spin filters @mobile', async ({ page }) => {
  test.skip(test.info().project.name !== 'iPhone SE', 'Runs in the iPhone SE project.');
  await page.goto('/home?mins=60');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await expect(page.getByRole('heading', { name: 'Your filters' })).toBeVisible();
  await expect(page.getByLabel('Starting location')).toBeVisible();
});
