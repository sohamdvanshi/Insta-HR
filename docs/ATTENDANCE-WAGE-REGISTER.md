# Attendance upload and Form B wage registers

This patch is based on Phase 6 (the previously delivered Phase6-admin patch on the Phase5 baseline). Apply it to your `phase6` branch, not main or Phase 7. It adds an employer wage-register workflow and a super-admin read-only register view.

## Install in PowerShell

Stop running frontend/backend servers, and commit or stash any unrelated local source changes first. Put Attendance-wage-register.patch in the repository root.

```powershell
git switch phase6
git pull --ff-only origin phase6
git switch -c attendance-wages
git apply --check .\Attendance-wage-register.patch
git apply .\Attendance-wage-register.patch
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run migrate:wages
npm --prefix backend run test:wages
npm --prefix backend run test:phase5
npm --prefix backend run test:phase6
if (Test-Path .\frontend\.next) { Remove-Item -Recurse -Force .\frontend\.next }
npm --prefix frontend run build
```

Phase 6 migration must already have run. The new migration creates only `wage_registers`, preserves existing payroll/attendance data, and is repeatable. It requires the existing configured PostgreSQL connection in backend .env. Back up the database before migrations. No automatic destructive rollback is provided.

Start in separate terminals:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

Employer: http://localhost:3000/employer/wage-register

Super admin: http://localhost:3000/super-admin/wage-register

Commit/push after reviewing:

```powershell
git add backend/package.json backend/package-lock.json backend/migrations backend/scripts/db backend/src frontend/src docs/ATTENDANCE-WAGE-REGISTER.md backend/test/wages*.test.js
git diff --cached --stat
git commit -m "Add attendance import and Form B wage registers"
git push -u origin attendance-wages
```

The ZIP contains a patch and changed files, not a complete repository. Use the patch OR overlay the changed-files folder; do not do both. No dependencies, environment files, employee workbooks or generated builds are included.

## Employer workflow

1. Choose payroll month and site/establishment.
2. Upload the provided attendance-template `.xlsx` format: employee IDs, employee names, actual Excel date headers under the employee heading, and daily codes.
3. Preview employees and counts. Existing summary formulas are ignored. Actual date headers determine the month, even if a printed heading is stale.
4. Confirm import to create a draft. One register per employer/month/site is allowed; keep site names consistent. Duplicate imports cannot silently overwrite a register.
5. Select employees individually or select all employees visible under the wage-group filter. Open bulk entry, set a group name and any shared wage values. Blank bulk fields preserve individual values; explicit zero clears an amount. Group names and wage settings persist in this register.
6. Open each employee's details to set overtime, UAN, individual amounts, receipts, dates and remarks. View the daily attendance breakdown.
7. Save wages. Totals are recalculated on the backend; browser totals are only a preview. Version checks reject edits from stale tabs. Discard unsaved edits reloads the saved record.
8. If attendance needs correction, fix the source file, preview it with the same month/site, then use **Replace attendance in open draft**. Matching employee IDs retain wage settings; removed employees leave the draft; new employees start at zero. Review all totals after replacement.
9. Export a draft for review or approve and lock it, then export the approved register. Approval requires positive wage rates, nonnegative net amounts and no blank daily codes. Approved registers cannot be edited or replaced in this version. Approval does not perform a bank transfer or mark payroll paid.

The feature stores the employer's external Excel employee IDs; it does not create candidate accounts or guess identities by name. IDs should be stable and unique. Use text-formatted employee IDs to preserve leading zeroes.

## Formula mapping

| Field | Portal and exported Excel rule |
| --- | --- |
| Present days | Number of P daily codes |
| Public holidays | Number of PH codes; H imports as PH |
| Payable days feeding wages | P + PH |
| Weekly offs, absences and leave | Excluded from wage days |
| Basic | Daily wage rate × payable days |
| Overtime | Daily wage rate / 4 × overtime hours |
| Total earnings | Basic + Special Basic + DA + overtime + HRA + Other earnings |
| Employee PF | min(Basic, 15000) × 12% |
| Employee ESIC | ROUND(Total earnings × 0.75%, 0) |
| Total deductions | PF + ESIC + Society + Income Tax + Insurance + Other deductions + Recoveries |
| Net payment | Total earnings − total deductions |
| Employer PF/welfare share | Manual amount; separate from employee deductions |

Special Basic, DA, HRA, Other earnings, Society, Income Tax, Insurance, Other deductions, Recoveries and employer contribution are manual amounts, matching the supplied workbook's employee row. This version does not infer tax eligibility or alternative contribution rules. The fixed calculations reproduce this supplied template; they are not a general statutory rules engine.

Amounts and overtime accept up to two decimals. Monetary components/totals round to paise; ESIC rounds to whole rupees. The exported formulas use the same rounding so cached results and recalculated Excel results agree. The PF cap is on Basic earnings, not total earnings. Overtime uses the workbook's daily-rate/4 formula, not an inferred hours-per-day conversion.

Example: rate 595, 26 payable days, zero other amounts → Basic 15,470; PF 1,800; ESIC 116; deductions 1,916; net 13,554.

Export contains two sheets: daily attendance with P+PH COUNTIF formulas, and the Form B wage columns in the original order with cross-sheet days, earnings, deductions, net and totals formulas. Receipt, date, remarks and employer share remain manual. It is not a pixel-identical reproduction of the original workbook's letterhead. Draft/approved status is printed in the export. Excel edits do not automatically update the portal; saved portal data is the source of record.

## Import rules

- `.xlsx` only, maximum 5 MB compressed / 40 MB expanded, 20 worksheets.
- Exactly one attendance sheet in the provided template format. Every date of the selected month must be present and unique.
- Maximum 500 employees / 1,000 worksheet rows. The provided template's merged headings and TOTAL ON MUSTER footer are supported.
- Accepted codes: P, PH, H, WO, A, CL, CO, LWP, OD, PL, SL, HD and blank. Only P and PH/H add payable days. Unsupported codes are rejected; blanks appear in review and block approval.
- Daily formulas, formula-based employee IDs and formula-based names are rejected. Summary formulas are ignored and not executed. Keep daily codes and identities as values.
- Legacy `.xls` attendance must first be saved as `.xlsx` in Excel. The original `.xls` wage workbook supplied in this conversation was used to identify formulas; employers do not need to upload that wage workbook each month.

## Access and integration

Employer can read, create, update, approve and export only their own registers. Super admin can list/read/export every employer's register but cannot create or edit registers. Internal admins, candidates and trainers cannot access these new APIs. The super-admin page is inside the existing server-verified admin shell.

Endpoints are under `/api/v1/wage-registers`: list, preview, create, detail, update, `/:id/attendance`, `/:id/approve`, and `/:id/export`.

Imports, wage edits, attendance replacements and approvals create transactional Phase 6 audit entries. Failed audit recording rolls back the change. The registers are separate from the older deployment-based Payroll and Attendance tables because uploaded employees may not be registered candidates. Existing payroll creation, invoices and attendance screens remain available; links from those screens open the new workflow. Imported wages are not duplicated into older payroll records or invoice totals.

## Manual checks

- Upload the supplied attendance template for July 2024. Expect seven employees with payable days 27, 27, 27, 26, 27, 27, 18. Its H holiday maps to PH. Weekly offs do not increase these values.
- Import twice for the same month/site: the second create must be rejected, with the original draft retained.
- Select the employee with 26 payable days and set rate 595, other amounts zero. Confirm 15,470 earnings, 1,916 deductions and 13,554 net.
- Apply a shared rate to two employees with different payable days. Verify their Basic/net amounts differ; set individual overtime or recovery and verify only that employee changes.
- Save, refresh and reopen: amounts and groups should persist. Use two tabs to verify stale saves are rejected.
- Correct daily attendance in the workbook and replace the draft. Confirm counts update and matching employees keep wage settings.
- Try negative inputs, duplicate employee IDs, unsupported codes, the wrong month, missing date columns and blank attendance. They should be rejected or, for blanks, block approval.
- Export, open in Excel, verify formulas and cached totals. Edit exported values locally and verify Excel recalculation; these edits should not alter saved portal data.
- Approve: editing/replacement must be blocked afterward; export must remain available.
- Log in as another employer: no access to the first employer's registers. Super admin can read/export them. Candidate/trainer/internal admin access must be denied.
- Open Phase 6 audit logs and find wage_register.import/update/replace_attendance/approve entries.
- Recheck existing payroll, attendance and training flows.

## Verification

13 new calculation/import/export/API tests passed, including real Express/JWT authorization with ORM doubles, ownership, duplicate prevention, stale versions, approval locking, attendance replacement, audit rollback and the supplied wage example. Existing 13 Phase 5 and 16 Phase 6 tests passed. The actual supplied attendance workbook parsed successfully with the counts above.

Production build was checked with a temporary local-font fallback because this environment cannot retrieve the existing Google Inter font; that temporary layout change is excluded from the patch. Live PostgreSQL migration and browser checks still need to be run in your environment. No GitHub push or deployment was performed.
