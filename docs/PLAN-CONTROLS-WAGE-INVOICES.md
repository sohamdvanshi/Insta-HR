# Plan comparison controls and individual wage invoices

This is a follow-up to `Phase7-plan-attributes.patch`. Apply that patch first. This patch does not repeat its changes. The local baseline is the tree produced by that patch on `phase7` commit `3d824c8`.

## Plan controls

Superadmin → Plans now uses real Yes/No switches for boolean values, including Featured jobs, AI Screening, Social Promotion, Dedicated Support, Account Manager and API Access. Job Postings and Resume Views have numeric monthly allowances and an Unlimited checkbox. AI screening level has validated Basic/Advanced/Custom options. The existing resume-builder limit remains separate from resume views.

The Full Feature Comparison table no longer contains a hard-coded matrix. It uses the same active plans, labels and saved attribute values as the plan cards. Editing values in Plans and refreshing the pricing page updates both. Inactive plans disappear from both views. Disabling AI Screening shows a cross instead of its level; the level also disappears from that plan's card. Authenticated subscription responses expose the saved settings too.

The migration initializes the former comparison values: Free has 3 job postings and 5 resume views per month; Standard has unlimited job postings and 100 resume views; Premium/Enterprise have unlimited values. AI is off for Free, Basic for Standard, Advanced for Premium, Custom for Enterprise. Social Promotion and Dedicated Support start enabled for Premium/Enterprise; Account Manager and API Access start enabled for Enterprise. Existing configured values win over these defaults, including on migration reruns. Featured-job settings are preserved.

These new settings are stored plan/comparison details and entitlement metadata. This patch does not implement monthly job/view usage counters, a new API-key authentication product, social promotion automation or support fulfilment. AI level describes the plan; it does not install different AI engines. The existing backend-enforced resume-builder limit and featured-job permission continue to work. Enabling a service benefit requires that service to be provided. Do not treat comparison allowances as newly enforced quotas.

## Wage invoices

Each employee row in an **approved** wage register now offers **Create invoice**. After creation, the action becomes **Download invoice**. Employers can create/download only in their own registers; superadmins can do so across employers. Other roles cannot use these wage-register endpoints.

The server takes the employee from the saved register and recalculates earnings, deductions and net payable using the existing wage formulas. It never accepts a client-provided invoice amount. Invoice subtotal and total are exactly net payable, with zero additional tax. The PDF includes the employee name/ID, designation, site, payroll month, payable days, daily rate, gross earnings, deductions and net payable.

Invoice snapshots are saved on the register with a stable number and the register version. Repeating creation for the same employee returns the same invoice; row locking prevents concurrent duplicate creation. Amounts are immutable after creation. A failed audit rolls back invoice creation. Draft/submitted registers must complete the existing review/approval workflow first. Unsaved wage edits cannot be used to create an invoice.

The invoice is marked **Issued**, not Paid. Creation neither transfers money nor records settlement. It is not a tax-reporting or statutory filing feature. PDF labels remain English.

## Invoice navigation

The separate Invoices entries are removed from employer/admin/superadmin navigation and admin user-detail tabs. Old employer invoice pages redirect to the employer wage register; old superadmin invoice pages redirect to the superadmin wage register. The old internal-admin invoice page redirects to the admin overview, because internal admins do not have wage-register access.

Historical invoice database records and APIs are retained. Subscription payment invoices remain available through payment history; they are separate from employee wage invoices.

## Installation — PowerShell from project root

Apply this **after** `Phase7-plan-attributes.patch`:

```powershell
Set-Location D:\college\TY-Project\Insta-HR-main
git status
git apply --check .\Phase7-plan-controls-wage-invoices.patch
git apply .\Phase7-plan-controls-wage-invoices.patch
npm --prefix backend run migrate:plan-attributes
npm --prefix backend run migrate:wage-invoices
npm --prefix frontend run build
```

Back up the database before migration. Both migrations are rerunnable. The new migration adds a JSONB invoice-snapshot field to wage registers and seeds missing comparison values without replacing existing values. Restart both servers afterwards. No new runtime dependencies are required. If the patch check fails, stop and reconcile the base instead of forcing application.

## Verification

Verified on 24 October 2026: 137 backend tests passed, 40 frontend tests passed, and the production build/TypeScript passed. A generated sample PDF was rendered and checked; the example gross wage of INR 15,470 minus INR 1,916 deductions produced an invoice of INR 13,554.

Tests cover plan-setting persistence/types, dynamic comparison rendering, switch booleans, removed navigation, per-employee UI actions, authenticated invoice ownership, approval/version checks, amount tampering, repeat creation, PDF output, audit rollback and migration reruns. Database tests use isolated ORM doubles; no production database or payment provider was modified.

Manual checks:

1. Toggle Social Promotion/API Access on one plan and save with a reason. Refresh Subscription and confirm both its card and comparison table change.
2. Change a monthly allowance, toggle Unlimited, and change AI level. Disable AI Screening and verify its comparison cell becomes a cross.
3. Approve a populated wage register. Create an invoice beside one employee, then download it. Compare its total with that employee's Net column.
4. Repeat creation, including from two tabs. Confirm the invoice number stays the same and only one snapshot exists for that employee.
5. Confirm a draft/submitted register cannot create invoices. Try an old version and another employer's register; both must be rejected appropriately.
6. Check that invoice menu entries and user-detail invoice tabs are gone. Check the legacy URL redirects and confirm subscription payment invoices still download.
