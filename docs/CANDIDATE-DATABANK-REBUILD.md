# Candidate databank rebuild and profile repair

Apply after Phase7-resume-databank-ai-match-fix.patch. This is an incremental patch. No dependency installation is required.

## Fixed issues

1. **Duplicate candidate cards:** the earlier patch listed resumes/uploads separately. Results now group by account user ID, with all authorized resumes inside one expandable list. Repeated file URLs are deduplicated. Different accounts with the same name remain separate people. Account email takes priority over editable resume contact text.
2. **Incomplete filtering:** rebuilt search supports keyword/name/email/resume text, city, job type, industry, all requested skills, minimum/maximum experience, education/qualification and maximum expected salary. City includes current, explicitly preferred and applied-job cities. A Mumbai resident applying to a Pune part-time job appears for Pune + part-time while the card still shows Mumbai as the current location. Job types include explicit preferences and applied job types. Profile forms now save preferred cities and job types. Work-history duration accepts both profile from/to fields and builder startDate/endDate fields and merges overlaps.
3. **AI-service errors blocked results:** matching attempts the configured service with a four-second timeout per batch. Connection failure, timeout, HTTP error or invalid/incomplete results trigger built-in basic matching for the entire candidate pool. The page explicitly labels basic matching. Scores use skills, experience and resume-text relevance; healthy remote responses remain in AI mode. Every eligible applicant remains included, including hired applicants. No 500-candidate truncation. This does not start a stopped Python process; the screenshot alone cannot establish the exact local outage cause.
4. **Profile foreign-key failure:** the migration inspects candidateprofiles.userId, repairs references to tables/columns other than the application's case-sensitive "Users"."id", and adds preference columns. Correct existing constraints are preserved. The migration is transactional and repeatable. It preserves historical orphan profiles; a NOT VALID constraint protects new/changed references when such rows exist, and the script reports their count. With no orphans, the constraint is fully validated. No accounts are fabricated and profiles are not reassigned. Remaining FK failures produce an actionable PROFILE_SCHEMA_MISMATCH response instead of raw SQL.

Public/shared candidates and the employer's own applicants form the eligible pool. Other applications contribute only city/type aggregates for already-visible candidates. Another employer's application IDs, statuses, companies and submitted files are not exposed. Private unshared builder resumes remain private.

## Apply once

Stop the backend, then run from the repository root in PowerShell:

```powershell
git apply --check .\Phase7-candidate-databank-rebuild.patch
git apply .\Phase7-candidate-databank-rebuild.patch
node .\backend\scripts\db\migrate-candidate-databank.js
npm --prefix frontend run i18n:index
node --test backend/test/candidate*.test.js backend/test/audit*.test.js
node --test frontend/test/candidate-discovery.test.cjs frontend/test/audit.test.cjs frontend/test/i18n.test.cjs
npm --prefix frontend run build
```

The migration explicitly reads backend/.env. If it fails, resolve its reported error before restarting the backend. Restart both apps after migration/build succeed. The generated translation index is omitted from the patch to preserve previous password-reset/navbar additions; regenerate it using the command above. No package.json changes are needed.

## Validation

- 53 backend tests passed, covering grouping/filtering, matching modes, ownership, migration branches, profile errors and existing audit checks.
- 21 frontend tests passed, covering grouped links, city/type requests, stale responses, fallback notice, saving preferences, localization and audit checks.
- Next.js production build and TypeScript passed.

Tests use actual Express/authentication and page handlers with ORM/provider test doubles. Migration tests cover repair, repeat execution, rollback and orphan preservation. The migration was not run against the user's PostgreSQL database; its exact FK target was unavailable for inspection. These local acceptance checks remain necessary.

## Manual checks

1. Confirm the migration success message. Save a candidate profile, reload and confirm name/preferences persist.
2. Confirm Savf has one card per account, with authorized resume links in its Resumes list.
3. Set Mumbai as current location and apply to a Pune part-time job. Both Mumbai and Pune searches should find the candidate; Pune + part-time should also match.
4. Save Bengaluru + full-time as explicit preferences and verify those filters.
5. Test skill, qualification, experience range and expected salary filters, then Clear Filters.
6. Stop the Python engine: Find Matches should show applicants with the basic-matching notice. With a healthy engine configured, the notice should disappear.
7. Verify hired applicants remain included and changing jobs during a request never displays the old job's results.
