# package.json changes

Add these to `"scripts"` in `package.json` (keep your existing scripts):

```json
"test:e2e": "playwright test --project=setup --project=chromium --project=firefox --project=webkit --project=mobile",
"test:e2e:ui": "playwright test --ui",
"test:e2e:report": "playwright show-report",
"test:unit": "playwright test --project=unit",
"test:mocked": "playwright test --project=mocked",
"test:api": "playwright test --project=api"
```

Then:
- Append the contents of `.gitignore.add` to `.gitignore`.
- Add `E2E_EMAIL=` and `E2E_PASSWORD=` (the dedicated test account) to `.env`.
- Delete `tests/example.spec.ts` and the old `tests/test-2.spec.ts` if they still exist (the new `tests/auth.spec.ts` replaces them).
- Make sure `@supabase/supabase-js` is installed (it already is, the app uses it).
