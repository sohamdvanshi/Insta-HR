# Resume databank and AI match fixes

Base: phase7 commit eebdd4c (Fix phase7 bugs and localize wage register).
This patch is independent of the password-reset and navbar/attendance-template patches. It changes no database schema or dependencies.

## Detected and fixed bugs

1. **Databank queried only candidateprofiles.** Builder resumes live in the separate resumes table and were never returned. The databank now includes each link-shared builder resume, public candidate profiles and resume uploads submitted to the logged-in employer's jobs. It does not require a separate candidate profile for builder resumes or applications. Multiple shared resumes remain separate entries; repeated uploads of the same file by the same candidate are deduplicated.
2. **Filters ignored builder and application data.** Names, titles, contact details, locations, skills, sectors and work periods are normalized into the existing card format. Submitted uploads can inherit searchable fields from the candidate's shared builder resume. Keyword search also checks skills, email and available submitted resume text. Location/industry matching ignores case; industry accepts sector codes with underscores; a comma-separated skill filter requires every listed skill. Minimum experience rejects negative/nonfinite values. Builder experience merges overlapping employment dates rather than counting simultaneous jobs twice. Clear Filters returns the full eligible list.
3. **Builder resumes had no databank View Resume link.** Shared builder cards now open the existing /resume/share/:id page. Submitted relative upload URLs use the configured backend origin instead of the frontend origin. Builder titles distinguish a candidate's multiple resumes.
4. **AI match queried only profiles, ignoring applications.** The selected job's applicants are loaded directly, including hired/rejected applicants and candidates without profiles. Profile/shared-builder data enriches the matching payload, and submitted resume text is sent for text relevance. Shared/public candidates remain discoverable; unrelated private profiles/resumes and submissions to another employer's jobs are excluded. Candidates are deduplicated by user ID; their application status is preserved in the response.
5. **AI match silently dropped candidates after 500 profiles.** Provider requests are now bounded to 250 candidates each and combined/sorted, without dropping later candidates or any applicant.
6. **An incomplete provider response could look like an empty candidate pool.** Failed/invalid/incomplete provider responses return 503 AI service unavailable. An eligible empty pool returns the normal empty result without contacting AI. Job ownership, feature flags and authentication remain enforced before provider access. Payloads include matching fields rather than the entire profile or account metadata.
7. **Older requests could overwrite newer filters/job selections.** Both pages now ignore stale responses; switching jobs clears the previous results. The databank also handles corrupt stored user JSON safely.

## Apply once

From the repository root in PowerShell:

```powershell
git apply --check .\Phase7-resume-databank-ai-match-fix.patch
git apply .\Phase7-resume-databank-ai-match-fix.patch
node --test backend/test/candidate-discovery.test.js backend/test/audit*.test.js
node --test frontend/test/candidate-discovery.test.cjs frontend/test/audit.test.cjs frontend/test/i18n.test.cjs
npm --prefix frontend run build
```

Restart the backend and frontend after applying. Keep the Python AI engine running at AI_SERVICE_URL (default http://localhost:8000). No new migration or AI engine code change is required. The patch leaves the generated translation index unchanged so it can coexist with the earlier patches; the existing translated description key is reused with updated EN/HI/MR text.

## Validation

- Backend: 41 passing tests (12 new discovery/route tests plus 29 audit tests).
- Frontend: 18 passing tests (3 new page interaction tests, 7 audit and 8 localization tests).
- Production Next.js build and TypeScript: passed.
- Patch applicability checked against the phase7 base and the checkout containing the earlier password-reset and navbar/template patches.

Tests exercise the actual Express routes with JWT authentication and the actual page handlers/rendered elements. ORM queries and the remote AI provider use test doubles. Live PostgreSQL records, real browser downloads and the user's running Python service require the checks below.

## Manual checks

1. Open Resume Databank with filters empty. Confirm shared builder resumes and uploads from your own applicants appear. Open one builder resume and one uploaded file.
2. Search by location, industry, skills and minimum experience. Clear Filters, including while another search is in progress.
3. For the job in the screenshot with two hired applicants, click Find Matches. Both applicants must appear; additional public/shared candidates may also appear because this page supports discovery as well as applicant matching.
4. Switch jobs during matching and confirm the displayed results belong to the newly selected job.
5. A builder resume marked private is not listed globally. Share it using its existing visibility setting to make it available in the databank. An employer can still see the resume that the candidate actually submitted to that employer's job.
6. If the AI engine is stopped, matching must report AI service unavailable, rather than No candidates found.
