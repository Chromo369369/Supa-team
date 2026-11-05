import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type E2EContext = {
  client: SupabaseClient;
  userId: string;
  runTag: string;
  registerGroupCode: (code: string) => void;
  registerStoragePath: (path: string) => void;
  seedPassportTrip: () => Promise<{ id: number | string; end_stop: string }>;
};

export async function createE2EContext(): Promise<E2EContext & { dispose: () => Promise<void> }> {
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_KEY;
  const email = process.env.E2E_EMAIL || process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_PASSWORD || process.env.E2E_TEST_PASSWORD;

  if (!supabaseUrl || !supabaseKey || !email || !password) {
    throw new Error('Set NUXT_PUBLIC_SUPABASE_URL, NUXT_PUBLIC_SUPABASE_KEY, E2E_EMAIL, and E2E_PASSWORD in .env.');
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Could not sign in the E2E user: ${error?.message ?? 'no user returned'}`);

  const runTag = 'e2e-' + Date.now();
  const groupCodes = new Set<string>();
  const storagePaths = new Set<string>();

  async function cleanupTaggedRows() {
    const { data: taggedChallenges, error: challengeReadError } = await client
      .from('challenges').select('id, photo_path').eq('user_id', data.user.id).like('title', `%${runTag}%`);
    if (challengeReadError && !isMissingTable(challengeReadError)) throw challengeReadError;

    const challengeIds = (taggedChallenges ?? []).map(row => row.id);
    if (challengeIds.length) {
      const { data: proofs, error: proofReadError } = await client
        .from('challenge_completions').select('photo_path').in('challenge_id', challengeIds);
      if (proofReadError && !isMissingTable(proofReadError)) throw proofReadError;
      for (const proof of proofs ?? []) if (proof.photo_path) storagePaths.add(proof.photo_path);
      const { error } = await client.from('challenge_completions').delete().in('challenge_id', challengeIds);
      if (error && !isMissingTable(error)) throw error;
    }

    const { data: taggedSignposts, error: signpostReadError } = await client
      .from('signposts').select('id, photo_path').eq('user_id', data.user.id).like('note', `%${runTag}%`);
    if (signpostReadError && !isMissingTable(signpostReadError)) throw signpostReadError;
    const signpostIds = (taggedSignposts ?? []).map(row => row.id);
    if (signpostIds.length) {
      for (const row of taggedSignposts ?? []) if (row.photo_path) storagePaths.add(row.photo_path);
      const { error } = await client.from('signpost_votes').delete().in('signpost_id', signpostIds);
      if (error && !isMissingTable(error)) throw error;
      const { error: deleteError } = await client.from('signposts').delete().in('id', signpostIds);
      if (deleteError && !isMissingTable(deleteError)) throw deleteError;
    }

    if (challengeIds.length) {
      for (const row of taggedChallenges ?? []) if (row.photo_path) storagePaths.add(row.photo_path);
      const { error } = await client.from('challenges').delete().in('id', challengeIds);
      if (error && !isMissingTable(error)) throw error;
    }

    const { data: trips, error: tripReadError } = await client
      .from('passport_entries').select('id').eq('user_id', data.user.id).like('entry_notes', `%${runTag}%`);
    if (tripReadError && !isMissingTable(tripReadError)) throw tripReadError;
    const tripIds = (trips ?? []).map(row => row.id);
    if (tripIds.length) {
      const { error } = await client.from('passport_entries').delete().in('id', tripIds);
      if (error && !isMissingTable(error)) throw error;
    }

    if (storagePaths.size) {
      const { error } = await client.storage.from('place-photos').remove([...storagePaths]);
      if (error) throw error;
      const { error: photoRowsError } = await client.from('place_photos').delete().in('path', [...storagePaths]);
      if (photoRowsError && !isMissingTable(photoRowsError)) throw photoRowsError;
    }

    for (const code of groupCodes) {
      const { error: optionsError } = await client.from('group_spin_options').delete().eq('group_code', code);
      if (optionsError && !isMissingTable(optionsError)) throw optionsError;
      const { error: membersError } = await client.from('group_members').delete().eq('group_code', code);
      if (membersError) throw membersError;
      const { error: groupError } = await client.from('groups').delete().eq('group_code', code).eq('host_id', data.user.id);
      if (groupError) throw groupError;
    }
  }

  return {
    client,
    userId: data.user.id,
    runTag,
    registerGroupCode: code => groupCodes.add(code),
    registerStoragePath: path => storagePaths.add(path),
    async seedPassportTrip() {
      const trip = {
        starting_stop: 'E2E Starting Stop',
        end_stop: `${runTag} Sample Stop`,
        time_taken: 25,
        bus_taken: 'E2E',
        starting_location: 'E2E Test Location',
        entry_notes: `${runTag} passport fixture`,
      };
      const { data: inserted, error: insertError } = await client.from('passport_entries').insert(trip).select('id, end_stop').single();
      if (insertError) throw insertError;
      return inserted;
    },
    async dispose() {
      try {
        await cleanupTaggedRows();
      } finally {
        await client.auth.signOut();
      }
    },
  };
}

function isMissingTable(error: { code?: string }) {
  return error.code === 'PGRST205' || error.code === '42P01';
}
