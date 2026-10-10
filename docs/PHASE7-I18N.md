# Phase 7 — English, Hindi and Marathi UI

Built on the exact local Phase 6 version delivered in Phase6-admin.patch / Phase6-admin.zip. Phase 6 does not need to be on GitHub. This patch is separate and contains frontend changes plus this guide. It does not overwrite either earlier patch file.

## Apply after Phase 6

If you have not integrated Phase 6 yet, follow PHASE6-ADMIN.md first: apply that patch on Phase 5 and run its database migration. Then commit the Phase 6 changes so your working tree is clean. Stop any running frontend dev server.

From your repository root in PowerShell, while on the branch that contains Phase 6:

```powershell
git status
git switch -c phase7
# Put Phase7-i18n.patch in the repository root.
git apply --check .\Phase7-i18n.patch
git apply .\Phase7-i18n.patch
npm --prefix frontend ci
npm --prefix frontend run test:i18n
if (Test-Path .\frontend\.next) { Remove-Item -Recurse -Force .\frontend\.next }
npm --prefix frontend run build
```

A silent `git apply --check` means the patch is compatible; it does not apply the changes. If the check fails, stop and compare your files with the delivered Phase 6 version. Do not force it or apply both the patch and ZIP source files.

No additional Phase 7 database migration, package dependency, default account, password, or feature flag is added. Start backend and frontend in separate terminals:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

Keep your existing backend environment settings and frontend NEXT_PUBLIC_API_URL. Phase 6 roles, training access, plan settings and APIs remain the baseline.

After testing:

```powershell
git add frontend/package.json frontend/src frontend/scripts frontend/test docs/PHASE7-I18N.md
git diff --cached --stat
git commit -m "Add EN HI MR localization and UI polish"
git push -u origin phase7
```

Nothing was pushed or deployed by the assistant. The ZIP includes the patch, this README, a manifest, and changed files under `changed-files/`; no credentials, dependencies, or build output are included.

## What changed

- Ten namespaces for each language in frontend/src/locales: common, jobs, auth, dashboard, payroll, training, resume, subscription, admin, errors. Existing common keys remain compatible with the navigation.
- UI translations across jobs/search/details/applications/sharing, registration/login/OTP, candidate/employer dashboards and profiles, referrals, saved jobs, resume builder/previews, subscriptions, payroll/attendance/contracts/deployment/manpower, analytics, trainer/course/class/certificate flows, and Phase 6 admin/super-admin tools.
- Buttons, labels, placeholders, accessible labels, empty/loading states, confirmations, success messages, known backend errors and validation messages use the catalogs. Unexpected technical errors in error displays use a localized generic message; details remain available in the backend response/logs.
- Runtime language subscriptions refresh copy without remounting pages. Form input, selected IDs, routes, authentication and stored business values are preserved. The switcher persists its supported language, handles unavailable browser storage, syncs other tabs, and restores after hydration without a server/client language mismatch.
- The document language and title follow the selected language. Only EN/HI/MR are offered.
- Native HTML validation gets localized required/email/URL/pattern/length/range/step messages. These clear as the user edits the field; existing custom validation is preserved.
- Dropdowns display translated options while explicitly submitting the original values. Backend role/status/industry identifiers and URLs are not translated.
- Dates/numbers use the selected Indian locale in presentation. Subscription prices and periods reformat during rendering so a language change does not leave stale labels. English job result counts handle singular/plural.
- Authored job/referral sharing text follows the selected language while retaining exact titles, locations, links and referral codes.
- Local system font fallbacks support Latin/Devanagari and remove the build's Google Fonts network dependency. Shared focus styles and wrapping improve keyboard use and longer translated labels.

Catalog keys use readable English source text for new copy. frontend/src/lib/localization.tsx provides the translation subscription/lookup and safe error presentation. frontend/src/locales/source-index.json maps that copy to namespaces; it also supports existing stored English system messages and dynamic placeholders without changing API payloads. Native validation helpers are in frontend/src/lib/formValidation.ts.

## Translation maintenance

Add the same key to the matching EN/HI/MR namespace, preserving placeholder names such as {{value0}} or {{count}}. English text is the fallback for new, unrecognized copy until its catalog entry exists.

```powershell
npm --prefix frontend run i18n:index
npm --prefix frontend run test:i18n
npm --prefix frontend run build
```

Use `tr(...)` for app-authored presentation and `useLocale()` in components that need language updates. Keep form values, API payloads, enum IDs and business data raw. Do not put translated text into HTML with dangerouslySetInnerHTML. UI content authored by users — names, messages, job/course descriptions, skills, resume text and uploaded documents — is not automatically translated. The backend's existing email templates and server-generated PDF documents remain in their existing language; this phase localizes the portal UI, its confirmations, and its authored sharing text.

## Manual test checklist

1. **Global language:** select हिंदी and मराठी, navigate between several pages and refresh. Check navigation/footer, title, and document language. Open a second tab and change the language in one tab. Both should update. Invalid stored language values should safely fall back to English.
2. **Forms retain input:** type into login/register, a job filter, a manpower/payroll form and a private admin note. Change language while typing. Inputs and selected IDs must remain unchanged. Repeat on a narrow/mobile viewport.
3. **Auth:** check login/register and both OTP routes in all three languages. Try empty/invalid email/password/OTP fields and server-side incorrect credentials. Check native and API validation. Complete login and verify candidate/employer/trainer/admin/super-admin destinations.
4. **Jobs:** search/filter/sort/paginate, save a job, create/pause/resume an alert, apply to a test job, and inspect application status. Translated labels must still submit the original filters/statuses. Check 0/1/multiple job results, empty states, referral sharing and copy/share feedback.
5. **Profiles/resumes:** edit a profile/resume, switch language without losing edits, save and open the preview/share page. Existing names, skills, experience and resume text must remain exactly as entered. UI section titles/buttons translate. Verify PDF download still works and Devanagari section headings fit.
6. **Subscriptions/payroll:** view plan prices, durations, existing perks, payment history and invoices; switch language again after data loads. Check dates/amounts. Test attendance, payroll, contracts, deployment and manpower forms with test records. Avoid real paid transactions while testing; use your existing Razorpay test setup for checkout.
7. **Training:** verify trainer workspace and candidate portal in Hindi/Marathi: courses, quiz editor, batches, physical/online schedules, attendance, progress, joins and certificate pages. Validate missing trainer/member/venue/link/time inputs. Check email delivery-count feedback and retry labels. Actual course titles/descriptions and meeting links remain unchanged.
8. **Admin/super admin:** open directories, profile activity, audit/analytics, support tickets/notes, staff/role controls, plans, flags and infrastructure. Change language with a pending form. Confirm admin restrictions and super-admin access still work. Inspect translated headers, statuses, confirmations and server validation.
9. **Keyboard/layout:** tab through the switcher, filters and actions. Check visible focus, translated accessible labels, long text wrapping, table scrolling and mobile navigation.
10. **Regressions:** run the existing Phase 5/6 tests and a clean normal frontend production build after applying both patches.

## Verification completed

- Seven i18n tests passed: language/namespace key parity, placeholder parity, indexed translations/plurals/interpolation, dynamic messages, native validation mapping, navbar keys, source-copy coverage, explicit dropdown values, untranslated CSS, and Hindi/Marathi rendered HTML with preserved personal data.
- Targeted ESLint passed for the new language/provider/validation helpers.
- Standard Next.js 16.1.6 Turbopack production build passed, including TypeScript and all 69 routes. A Webpack build also passed during verification.
- Existing Phase 5 (13 tests) and Phase 6 (16 tests) regression suites passed.
- Patch compatibility is checked against the delivered Phase 6 file contents.

Rendered HTML tests do not replace live browser testing. The available remote browser cannot reach this workspace's local preview, so full browser/hydration/mobile testing and your real database/provider flows require the checklist above. Translation key coverage is automated; language wording and final layout should be reviewed in your actual portal before deployment.
