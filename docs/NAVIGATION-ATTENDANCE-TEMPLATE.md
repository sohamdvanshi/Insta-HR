# Navigation and attendance-template update

Baseline: phase7 commit `eebdd4c`. This patch also works alongside the separate password-reset patch. It does not modify password-reset files or require a database migration.

## Navigation

| Profile | Visible main actions | Dropdowns |
| --- | --- | --- |
| Guest | Find Jobs, Training | Resources (certificate verification, pricing, employer registration), login/sign-up |
| Candidate | Dashboard, Find Jobs | Career, Learning, account (profile, upgrade, logout) |
| Employer | Dashboard, Post Job | Hiring, Operations, Finance, Resources, account (company profile, upgrade, logout) |
| Admin | Dashboard | People, Hiring, Finance, Training, Team tools, account/logout |
| Super admin | Dashboard | People, Hiring, Finance (including wage registers), Training, System Control, account/logout |
| Trainer | Dashboard | Training (trainer courses, batches/classes/attendance, public certificate verification), account/logout |

Work links use the correct role routes. Shared administration pages retain their existing /admin routes where no separate super-admin page exists. Public tools move into relevant secondary menus instead of appearing as unrelated top-level links for staff. The account dropdown contains identity, profile/plan links where those pages exist, and logout.

Desktop navigation switches to a scrollable mobile accordion below 1280px. Dropdowns close on outside pointer clicks, Escape, navigation and language changes. Escape returns focus to a visible trigger. Active dashboard links match the dashboard exactly, so they do not stay highlighted on every employer/admin page. Labels support EN/HI/MR; personal names remain unchanged.

## Employer attendance template

Select the payroll month on `/employer/wage-register`, then click **Download attendance template** in the import section. The API generates an XLSX named `attendance-template-YYYY-MM.xlsx` for that month.

- The Attendance sheet contains employee ID, name, location, designation and real Excel date columns for every day of the selected month.
- There are 50 blank employee rows with attendance-code dropdowns. ID cells use text formatting to preserve leading zeroes. No sample employees are added to payroll.
- The header and identity columns are frozen. A separate Instructions sheet describes codes, adding employees, upload steps and the existing payable-day policy.
- Fill the template, save as XLSX and upload using the same payroll month and your site. Preview before confirming import; enter wage rates in the portal.
- `GET /api/v1/wage-registers/template?period=YYYY-MM` requires an authenticated employer. It is registered before the `/:id` route. Staff read-only wage views do not offer the import/template controls.

The existing calculation policy remains P + PH (H mapped to PH); this change does not alter wage formulas.

## Apply

Copy the patch into the project root and run these commands once:

```powershell
git apply --check .\Phase7-navbar-attendance-template.patch
git apply .\Phase7-navbar-attendance-template.patch
npm --prefix frontend run i18n:index
npm --prefix frontend run test:audit
npm --prefix frontend run test:i18n
node --test frontend/test/navigation-template.test.cjs
npm --prefix backend run test:wages
npm --prefix backend run test:audit
npm --prefix frontend run build
```

The generated translation index is deliberately rebuilt after application so existing password-reset translations are retained. Stage the generated index together with these source changes. Restart the backend and frontend after verification. No new dependency or database migration is needed.

## Verification

Four new frontend tests cover role targets/permissions, translated menu labels, desktop/mobile Escape behavior and authenticated template download. Four new backend tests cover real date headers, 28/29/30/31-day months, workbook validation/formatting, blank rows, existing-importer round trip, invalid months and employer-only HTTP download.

Existing frontend audit (7), i18n (8), backend audit (29), and wage tests including new template cases (21) pass. TypeScript validation and the production build pass. No real database changes or emails are involved.

Manual check: sign in as each role, open menus at desktop and phone widths, switch language, navigate and log out. As employer, select the month, download/fill the workbook in Excel, upload it, preview the attendance, save wages, approve and export. A real browser interaction and native Excel editing pass remains useful alongside the automated checks.
