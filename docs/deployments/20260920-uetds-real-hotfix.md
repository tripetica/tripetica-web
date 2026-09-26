# U-ETDS production hotfix — 2026-09-20

Live: `/srv/tripetica/releases/20260920-uetds-real-hotfix`
Rollback: `/srv/tripetica/releases/20260920-uetds-company-key`

Cursor left two candidates: `20260920-uetds-real-runtime` and `20260920-uetds-prod-live-runtime`. The latter had no completed BUILD_ID and was not current. Its source was used as the isolated baseline; unrelated workspace changes were preserved.

Root cause: deployed implementation permitted DEV/TEST only; confirmation showed a fixed TEST notice. Cursor's candidate added server-side runtime, credential, readiness, and UI environment selection. Those changes were retained.

Additional reviewed changes:

- `lib/uetds/ministry-env.ts`
- `lib/uetds/ministry-plate.ts`
- `lib/uetds/ministry-submit.ts`
- `lib/uetds/ministry-mutate.ts`
- `lib/uetds/ministry-soap.ts`
- `lib/uetds/copy.ts`
- `components/uetds/uetds-notification-form.tsx`
- `lib/uetds/runtime-safety.test.ts`
- `lib/server-tests/uetds-runtime-safety.test.ts`

Exact official endpoint allowlist; reject redirects; reject empty transport credentials; normalize SOAP plates for creation and updates; reject official TEST plate in live runtime; localized live confirmation; runtime and mocked transport/credential tests.

Inherited candidate changes include Ops/Partner notification new/edit pages, notification forms, company readiness fields/tests, submit/manage, credentials, Ministry PDF, copy, and U-ETDS regression tests.

Validation:
- next typegen: PASS
- tsc --noEmit: PASS
- lib/uetds/*.test.ts: 74/74 PASS
- Ops, Ops push, Partner, Partner push, mocked credential/transport regression: 417/417 PASS
- Corrected test typing followed by targeted safety rerun: PASS
- Production next build: PASS
- Production env byte-for-byte identical to previous release; credential key unchanged.
- SEARCH TRAVEL active, stored/computed readiness ready; REAL credential decrypt succeeds; TEST credentials absent.
- RECEP YILDIRIM and 34 EGP 847 linked to SEARCH TRAVEL.
- SOAP canonical plate 34EGP847; production rejects 06TARIFESIZ123. TEST fixture retained for DEV only.
- After switch: service active/running, NRestarts=0. Public /tr and /en, Ops/Partner login return 200 via localhost and public HTTPS. Protected U-ETDS new/company routes redirect to login.
- Authenticated confirmation was verified in source/tests, not through an authenticated browser session.
- No actual Ministry mutation or other Ministry network request was sent. Transport tests used mocked fetch. Readiness queries were read-only.
- Temporary candidate server stopped. Rollback and previous candidates retained.
