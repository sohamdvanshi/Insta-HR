# Phase 6 — Admin controls and internal communication

This patch is based on the `phase5` branch of sohamdvanshi/Insta-HR (remote commit `5c510fdfb25f43b735151caa9d0db600514b8f9e`). It adds Phase 6 only; Phase 5 must already be present. No GitHub push or deployment was performed.

## Integrate on Windows / PowerShell

Keep a copy of your database before running migrations. Start with a clean working tree; commit or stash your own changes first. Place Phase6-admin.patch in the repository root.

```powershell
git switch phase5
git pull --ff-only origin phase5
git switch -c phase6
git apply --check .\Phase6-admin.patch
git apply .\Phase6-admin.patch
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run migrate:phase6
npm --prefix backend run test:phase5
npm --prefix backend run test:phase6
# Stop any running Next.js dev server before clearing its cache.
if (Test-Path .\frontend\.next) { Remove-Item -Recurse -Force .\frontend\.next }
npm --prefix frontend run build
```

`git apply --check` with no output means the patch can apply; `git apply` performs the changes. If the check fails, stop and compare the current branch with the baseline rather than forcing it. Do not apply both the patch and ZIP source files.

The ZIP contains the patch, this guide, and only the changed/new source files under `changed-files/`. Applying the patch is preferred because it checks the existing contents. There are no environment files, credentials, dependencies, or generated builds in the ZIP.

The migration runner first runs the repeatable Phase 5 migration and then Phase 6. It preserves existing records and seeds plans/flags once. It adds plan settings, feature flags, payment duration snapshots, internal communication/audit tables when missing, and supporting indexes. Destructive automatic rollback is deliberately unavailable. Use the existing backend database environment configuration; frontend NEXT_PUBLIC_API_URL should point to your backend API, normally http://localhost:5000/api/v1.

Run the two services in separate terminals:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

Use an existing active super_admin account to open `/super-admin`. This patch does not create a default super admin or change your passwords.

After reviewing and testing:

```powershell
git add backend/package.json backend/migrations backend/scripts backend/src backend/test frontend/src docs/PHASE6-ADMIN.md
git diff --cached --stat
git commit -m "Implement Phase 6 admin controls and internal communication"
git push -u origin phase6
```

## What changed

- Real admin and super-admin dashboards with totals for candidates, employers, jobs, applications, successful payment revenue, and open support tickets.
- Searchable, paginated candidate/employer/user directories and profile pages. Candidate activity includes resumes, applications, training enrollments, class attendance, deployment, attendance, payroll, invoices, loyalty, and payments. Employer activity includes jobs/applications, payments, invoices, deployment, attendance/payroll, contracts, manpower requests, and campaigns.
- Dedicated jobs, applications, payment, invoice, and audit views with filters and expandable details. Password hashes, OTP/auth secrets, and raw AI responses are excluded from these workspace responses.
- Reason-based job moderation, account activation, candidate loyalty corrections, employer verification, and super-admin subscription grants. Mutations and their audit records use transactions: an audit failure rolls back the change.
- Super-admin staff creation and role management. Internal admin is the existing `admin` role, distinct from `super_admin`. Self-removal and removing the last active super admin are blocked. Legacy activation/role endpoints use the same protections.
- Stored subscription plan price, duration, name, display perks, and availability. The public subscription page and checkout use these settings. Orders store their original price/duration, and verification checks provider capture, amount, currency, order ownership, and replay safety.
- Four runtime module flags: training, AI screening, referrals, and bulk email. Disabling a module blocks its gated API for ordinary users; verified active internal staff retain access for support. Flags are global, not per-user experiments.
- Infrastructure status page for database, Elasticsearch, Redis, process uptime/memory, and integration configuration presence. It does not expose credentials or control external hosting infrastructure.
- Private support tickets/threads, priorities, assignments, linked records, replies, closure/reopening, and private entity notes. Replies and notes are internal portal communication, not outbound emails. Notes can be deleted by their author or super admin, with an audit entry.
- Backend protection of all new workspace routes and frontend layouts that obtain the role from the backend before displaying tools.
- Clearer training error when the trainer role/database migration is missing.

Plan perk descriptions describe existing product behavior. Changing a description does not automatically implement a new entitlement. Plan IDs remain free, standard, premium, and enterprise.

## Roles

| Capability | Internal admin | Super admin | Candidate / employer / trainer |
| --- | --- | --- | --- |
| Directories, profiles, activity, jobs, applications, payments, invoices, audits | Yes | Yes | No workspace access |
| Tickets, replies, assignment, private notes | Yes | Yes | No |
| Candidate/employer/trainer account moderation | Yes, with reason | Yes, with reason | No |
| Job status, loyalty corrections, employer verification | Yes, with reason | Yes, with reason | No |
| Staff access/roles and staff creation | No | Yes, with reason | No |
| Manual subscription grants | No | Yes, with reason | No |
| Plans, flags, infrastructure | No | Yes | Public active plan catalog only |

Super admin retains the admin tools, including existing Phase 5 courses and training. Trainer access remains governed by Phase 5. No new public registration path can select an internal staff role.

## Pages

Both `/admin` and `/super-admin` provide overview, users, candidates, employers, jobs, applications, payments, invoices, audit-logs, and communication pages. User detail URLs are `/admin/users/<id>` and `/super-admin/users/<id>`. `/admin/support` opens the communication tool.

Super-only pages: `/super-admin/staff`, `/super-admin/plans`, `/super-admin/feature-flags`, `/super-admin/infrastructure`.

## Manual test checklist

Use test accounts and a test database. Keep an active super admin available.

1. **Roles and navigation:** sign in as super admin; open every new page and existing courses/training. Sign in as admin: overview/data/support/audit tools work, and direct super-admin page navigation returns to admin. Backend calls for staff creation, role changes, plans, flags, infrastructure, and subscription grants must reject admin with 403. Candidate/employer/trainer accounts cannot read workspace or internal notes.
2. **Staff:** create a test internal admin from Staff & roles. Sign in with that account and verify its tools. Change a test non-self account's role/access with a reason. Confirm self-removal and removal of the last active super admin are rejected. Check audits show actor, target, reason, and before/after changes without passwords.
3. **Directories:** search by email, phone, profile name, and company. Filter by role/active state and paginate. Open candidate education/skills/profile and employer profile. Open resume links and each activity tab; test empty histories too. Employer applications must belong to that employer's jobs. Data appears only if it exists; the patch does not fabricate history.
4. **Moderation:** change a test job among draft/active/closed. Deactivate/reactivate a test candidate. Try missing/short reasons and verify validation. Check the corresponding audit records. Search index updates are best effort; verify with Elasticsearch available if job search is part of your deployment.
5. **Adjustments:** add/subtract candidate loyalty points; balances cannot fall below zero and corrections are limited to ±1,000 per action. Change employer verification. As super admin, grant a stored active subscription for 1–365 days. A manual grant must not create a fake payment receipt. Admin cannot grant subscriptions.
6. **Payments/invoices:** compare successful/pending records, filter lists, and verify invoice views. Configure Razorpay TEST keys and complete a test checkout. Changing plan prices/durations after an order is created must not change that order's payment amount/duration. Repeated verification must not extend the subscription again. Pre-Phase-6 orders with no stored order snapshot require a new purchase or support review.
7. **Plans:** edit name, price, duration, perks, and availability with a reason. Refresh `/subscription` and confirm changes. Inactive plans disappear from new checkout choices. Restore the settings after testing. Prices in the UI are rupees; API storage is integer paise.
8. **Flags:** disable each module individually, then test its gated APIs as a normal user. Expect a service-unavailable response; active staff can still access it. Re-enable and verify normal operation. Navigation can remain visible: enforcement occurs at the backend. Check flag edits in audits.
9. **Infrastructure:** check database/Redis/Elasticsearch readiness and configured integration booleans. No key/password values should appear. Status reflects services actually running in your environment; absent dependencies can legitimately show unavailable.
10. **Tickets:** create a support ticket linked to a candidate/employer/job, assign active staff, search/filter, reply, and paginate messages. Close it and verify replies require reopening. Reassign/reopen and check audit entries.
11. **Notes:** add a private note on a profile and a ticket. A second internal admin can read it but cannot delete another admin's note; author and super admin can delete. Public users cannot retrieve notes.
12. **Phase 5 regression:** verify trainer login, courses, batches, class scheduling, trainee attendance, and candidate portal joins still work with training enabled. Run both test scripts and a clean frontend build.

## Verification performed

- 16 Phase 6 tests passed: protected Express/JWT routes, staff restrictions, concurrent last-super-admin protection, privacy, activity scoping, adjustment bounds, audit rollback, ticket/note access, feature flags, plan settings, payment snapshot/provider/replay checks, infrastructure secret exclusion, and migration repeatability.
- 13 existing Phase 5 tests passed.
- TypeScript passed and a Next.js production Webpack build compiled/prerendered 69 routes. The build environment could not fetch Google Fonts, so only the build check temporarily used local font fallbacks; the original font configuration is unchanged in the delivered patch.
- Database/provider tests use doubles; the migration has not been run against your PostgreSQL database. Real Razorpay, SMTP, Elasticsearch, Redis, and deployed browser flows still require the manual checks above.
- Browser verification was attempted but could not complete: the remote browser refused the local preview URL (ERR_BLOCKED_BY_CLIENT), and the local browser runtime had no installed Chromium binary. No browser success is claimed.
