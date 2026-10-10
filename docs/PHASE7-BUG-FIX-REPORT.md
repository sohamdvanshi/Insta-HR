# Phase 7 bug audit and fixes

Repository: sohamdvanshi/Insta-HR. Branch: phase7. Baseline: `f89afb8cd4f18c6b8e772fbac741c6736a0baa50` (Add Phase 7 English Hindi Marathi localization). Audit date: 2026-10-10.

The patch contains 33 grouped fixes across the frontend, API, operations workflows and Python matching service, plus regression tests and an additive database migration. It covers the code present on phase7, including earlier-phase functionality; it does not include the separate wage add-on. Nothing was pushed or deployed.

## Fixed bugs

Paths below are relative to the repository. A row can cover several manifestations of the same defect. Automated coverage is identified where available; reviewed-only fixes are not represented as live-service tests.

| ID | Detected behavior | Fixed behavior and primary files | Evidence |
| --- | --- | --- | --- |
| 01 | Portal requests and resume links pointed at localhost even when a hosted backend was configured. | Shared normalized API/backend configuration used throughout the portal; absolute uploaded URLs remain intact. `frontend/src/lib/api.ts`, app pages, adminApi/trainingApi. | Frontend audit tests; production build. |
| 02 | Localization translated user-authored names, resume skills, company/job/site names, notes, quiz content and other values matching UI dictionary entries. | Translate UI copy while preserving authored content. Frontend pages, Navbar and training components. | Rendered navbar and resume regression tests; i18n tests. |
| 03 | Conditional translation of `false` displayed the literal word false. | Boolean children render empty. `frontend/src/lib/localization.tsx`. | i18n regression assertion. |
| 04 | Corrupt or unavailable localStorage could crash page initialization. | Shared safe user reader rejects malformed JSON and non-object values. `frontend/src/lib/storage.ts`, consumers. | Frontend storage tests. |
| 05 | Registration stored an undefined token and an unverified user before OTP verification. Email query strings could be malformed. | Both registration flows clear premature session state, encode email and require candidate first name. Register/auth pages. | Code review and production build. |
| 06 | React StrictMode effect replay could create two resumes. | One creation promise is reused and stale navigation suppressed. `frontend/src/app/resume/new/page.tsx`. | Actual page effect replay test. |
| 07 | A slow job search could overwrite results for a newer filter selection. | Cancel earlier requests and ignore stale responses. `frontend/src/app/jobs/page.tsx`. | Actual page request-race test. |
| 08 | Aggregate administrative analytics were accessible without staff authentication. | Authenticate and authorize before controller/cache. `backend/src/routes/analytics.routes.js`. | API test, also failed against baseline. |
| 09 | super_admin was denied several endpoints available to admin. | Include super_admin in explicit staff permissions and owner bypasses. Admin audit, application, AI, candidate, employer, referral and job routes/controllers. | Staff API regression tests; route review. |
| 10 | A temporary database failure was reported as an invalid JWT; auth logs printed user details. | Operational failures return 503, invalid JWTs remain 401; remove debug logs. `backend/src/middleware/auth.js`. | API tests. |
| 11 | Candidate profile edits could overwrite identity and server-controlled upload metadata. | Whitelist editable fields for creation/update. candidate controller, `services/profileFields.js`. | API injection test. |
| 12 | Employers could self-verify, change profile ownership or manipulate job counts through profile editing. | Whitelist company fields and preserve server-managed attributes. employer controller, profileFields. | API injection test, also failed against baseline. |
| 13 | Candidate photo/resume metadata updates were ignored because ORM columns were missing. | Add photoUrl/photoPublicId/resumePublicId attributes and repeatable additive migration. CandidateProfile model, migration and runner. | ORM and repeat-migration tests using a query-interface double. |
| 14 | An employer could request AI candidate matches for another employer's job. | Check ownership before collecting or sending profiles. candidate controller. | API test asserting no provider call. |
| 15 | Matching returned the Python response envelope instead of the array expected by the UI; undeclared axios dependency and no timeout made failures fragile. | Use built-in fetch with a 15-second timeout, validate provider result and return candidate array. UI loads authenticated own jobs and reports errors. candidate controller, ai-match page. | Mocked provider API test; build. |
| 16 | Disabling AI did not stop automatic application scoring or direct match/rescreen endpoints. | Enforce feature flag on routes and automatic scoring; retain manual-review applications when disabled. application controller/routes, candidate routes. | Disabled-provider and manual-review API tests. |
| 17 | Applications were accepted for inactive jobs and expired deadlines. | Reject before parsing uploads and clean rejected temporary uploads. application controller. | API test, also failed against baseline. |
| 18 | Public job detail/list/search exposed drafts; cached detail was not scoped to the viewer. | Public queries restrict to active jobs; draft detail requires owner/staff; include viewer in detail cache key. job routes/controller, cache and search service. | Public/draft API tests, draft test also failed against baseline. |
| 19 | Redis 5 scan batches were not fully invalidated. | Handle batched arrays and legacy string/buffer scan entries. cache middleware. | Regression test, also failed against baseline. |
| 20 | Job mutations cleared the wrong detail-cache prefix, leaving stale details. | Invalidate the actual job-detail namespace. job controller. | Cache-key code review. |
| 21 | Admin job moderation left list/detail/employer/analytics caches and search visibility stale. | Invalidate caches after transaction and refresh search update. adminWorkspace controller. | Mutation-path code review. |
| 22 | Payroll month boundaries shifted a day on an India timezone server, excluding leap-day attendance. | Compute month start/end using UTC calendar dates. payroll controller, recordValidation. | Timezone/leap-year API test, also failed against baseline. |
| 23 | Malformed months/dates, reversed date ranges and invalid or out-of-range currency reached ORM writes. | Shared validation for payroll, invoices, attendance, deployments and contracts, including timestamp ordering. recordValidation and controllers. | API and validation tests; deployment/contract paths reviewed. |
| 24 | Binary floating-point arithmetic produced imprecise payroll net and invoice totals. | Validate two-decimal inputs and calculate totals in integer cents. payroll/invoice controllers. | Payroll and currency tests. |
| 25 | Duplicate attendance/payroll/invoice records returned generic 500 errors. | Return conflict 409 for uniqueness violations. Relevant controllers. | Error-handler code review. |
| 26 | Invoice identifiers used a small random suffix with collision risk. | Use timestamp plus UUID. invoice controller. | Identifier-path code review. |
| 27 | Registration could leave a user without a required candidate profile; Google names and referral collisions could fail creation. | Create user/profile atomically, validate names, use fallback Google names and retry referral collisions in fresh transactions. auth controller. | Missing-name and transaction-rollback tests; Google path review. |
| 28 | OTP delivery failure looked like failed registration after account creation; welcome-email failure made consumed OTP verification appear unsuccessful. | Return a recoverable pending account when OTP mail fails; do not fail successful verification because welcome mail fails; check inactive account before OTP consumption. auth controller. | Mocked email-outage API tests. |
| 29 | Missing/unreachable optional Redis, Elasticsearch or Razorpay could prevent startup; search failures could report a failed write after SQL committed. | Bound/disable optional connections, lazily initialize payments, skip unavailable indexing, tolerate indexing failures and fall back to SQL search. Config, server, payment controller and search service. | Missing-payment and mocked search-outage tests; startup-path review. |
| 30 | Advanced search accepted fractional/unbounded pagination and could undercount Elasticsearch results. | Normalize/cap pagination and request accurate total hits. search service. | Query construction review. |
| 31 | Repeated/concurrent campaign sends could resend emails; all-failed delivery was marked sent and counts could be lost. | Atomically claim draft campaigns, reject repeats, persist batch counters and mark failed when none succeed. bulkEmailCampaign controller. | Concurrent/repeat and all-failed tests with mocked delivery. |
| 32 | Python matching confused substring skills, discarded profile context, emitted None names and rejected fractional experience requirements. | Boundary-aware skill matching, profile-text fallback, safe names and float requirements. `ai-engine/main.py`. | Three Python scoring tests. |
| 33 | Health always claimed database connectivity; public upload diagnostics revealed filesystem details. | Probe database for 200/503 health and protect diagnostics with staff authorization. server. | Two Express server tests with mocked DB. |

## Verification completed

- Backend audit: 29/29 tests passed.
- Existing phase5 suite: 13/13 passed. Existing phase6 suite: 16/16 passed; its payment fixture now explicitly supplies a fake key.
- Frontend audit: 7/7 passed. Existing i18n suite: 7/7 passed.
- Python scoring: 3/3 passed.
- Frontend production build passed, including TypeScript validation and route generation.
- Six representative regressions were run against the unmodified baseline: analytics access, employer field injection, inactive-job applications, draft exposure, timezone payroll dates and Redis invalidation. All six failed on the baseline and pass with these fixes.
- The supplied patch was checked and applied to a separate clean checkout of the exact baseline. Git whitespace checks passed.

Total: 75 passing automated tests. Tests use actual Express routes/controllers with ORM/service doubles, frontend render/effect harnesses and pure Python scoring checks. No real emails or payment requests were made.

## Apply and configure

From a clean checkout at the baseline commit:

```bash
git apply --check /path/to/Phase7-bug-fixes.patch
git apply /path/to/Phase7-bug-fixes.patch
npm --prefix backend run migrate:phase7-audit
npm --prefix backend run test:audit
npm --prefix backend run test:phase5
npm --prefix backend run test:phase6
npm --prefix frontend run test:audit
npm --prefix frontend run test:i18n
npm --prefix frontend run build
(cd ai-engine && python3 -m unittest test_scoring.py)
```

Use the normal project dependency installation first if node_modules are absent. The migration uses the backend database environment configuration; run it against the intended database before deploying. It adds only missing candidate upload columns and deliberately has no destructive automatic rollback.

Set `NEXT_PUBLIC_API_URL` to your backend API root, such as `https://your-backend/api/v1`, before building the frontend. Optional `NEXT_PUBLIC_BACKEND_URL` sets the backend origin for relative uploads; otherwise it is derived from the API URL. The development default remains `http://localhost:5000/api/v1`.

## Manual checks still needed

1. On the deployed frontend, check EN/HI/MR switches, every navigation item and representative admin/training pages. Use authored values like Open and General to confirm names, notes and skills remain unchanged.
2. Test candidate and employer registration, OTP resend/verify, login/logout and Google sign-in with your configured provider. Confirm no logged-in session appears before verification.
3. Upload/replace photo and resume against the migrated database and Cloudinary; reload and confirm metadata persists and replacement removes the correct old asset.
4. As employer A, create a draft/active job and edit/moderate it. Check anonymous and employer B access, deadline rejection and immediate list/detail/search updates with real Redis and Elasticsearch. Check SQL fallback when search is unavailable; fallback uses ordinary SQL matching and recency ordering, without Elasticsearch fuzzy matching or featured relevance boosts.
5. Exercise AI enabled/disabled with the real FastAPI service, your actual resumes and fractional experience requirements. Verify match display and manual-review applications with AI off.
6. With real Postgres, create February/leap-year attendance, payroll and invoices; confirm boundaries/totals, duplicate conflicts, date-range errors and contract/deployment validation.
7. In a test email environment, send one campaign, attempt a repeated/concurrent send and simulate partial/all delivery failures. Confirm counters/status. A process crash can leave a campaign in sending; inspect delivery before manually recovering it to avoid duplicate email.
8. Verify missing payment configuration returns 503, then run an order/signature flow with sandbox Razorpay credentials. Check /health changes to 503 during a real DB outage and /uploads-check requires staff.

Live Postgres migration, provider authentication, SMTP, Cloudinary, Razorpay, Redis/Elasticsearch integration and FastAPI HTTP were not available for end-to-end verification here. A real browser interaction pass remains required; frontend verification used rendering/effect tests and a production build. This audit fixes identified defects and is not a guarantee that every possible bug has been eliminated.
