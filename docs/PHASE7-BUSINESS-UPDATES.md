# Phase 7 business updates

Patch base: `9b0dd63` on `phase7`. This patch extends the existing candidate, password-reset, attendance and navigation fixes; it does not replace those patches.

## Changes

| Request | Implemented behavior |
| --- | --- |
| Admin overview | Superadmin overview shows admin counts and a paginated admin-only list. Trainers, candidates, employers and superadmins are excluded from this list. Other role-management tools remain under Users. |
| Trainer navigation | Course management links back to Home for trainers. The access guard permits Home while continuing to block admin pages. Quiz navigation stays in trainer courses. |
| Wage register review | Employer saves a draft and submits it. Superadmin approves and locks it, or returns it to draft with a required correction note. Review notes are visible to employers. Submitted registers cannot be edited. Versions prevent stale reviews; review changes and audit records commit together. Existing approved registers remain approved. A database-error path that previously left requests hanging now returns an error response. |
| Backend plan settings | Prices, duration, descriptions, availability, yearly price, loyalty cost and featured-job permission are persisted and audited. Checkout uses server prices. Featured-job permission is enforced on the backend and read by the job forms. Other free-text perk descriptions remain informational; typing a perk does not create a new entitlement rule. |
| Yearly pricing | Monthly/yearly selector, editable yearly price, 365-day annual access and saved billing-cycle purchase terms. Initial yearly prices are monthly prices multiplied by 12, capped at the existing maximum price. There is no assumed annual discount. Same-plan renewals preserve unused time. Switching to a different plan requires the current subscription to expire. |
| Loyalty redemption | Candidate can redeem points from Referrals or Subscription. Default: 1,000 points for Premium's configured monthly duration (normally 30 days). Superadmin can change the cost; zero disables redemption. Deduction, subscription activation and audit are transactional. A unique request ID prevents duplicate deductions on retries. |
| Kannada and Tamil | Added `kn` and `ta` catalogs across all ten namespaces, language selector entries, locale formatting, persisted selection and document language. Existing English/Hindi/Marathi support remains. Names and authored content are preserved. Catalogs were machine-translated, with targeted terminology and numerical-placeholder corrections; native-speaker review remains appropriate before public release. |
| Invoices | Owner-scoped subscription and deployment PDF downloads; admins/superadmins can download from their collections. New subscription invoices snapshot purchase details at verification. Deployment invoices snapshot billing details at creation. Historical records acquire a snapshot on first download. Draft/sent/overdue/paid/cancelled transitions are validated and audited; settled invoices cannot reopen. |

## Installation — PowerShell

Run from the project root, not from inside `backend`:

```powershell
Set-Location D:\college\TY-Project\Insta-HR-main
git status
git apply --check .\Phase7-business-updates.patch
git apply .\Phase7-business-updates.patch
npm --prefix backend run migrate:business
npm --prefix backend run test:business
npm --prefix frontend run test:i18n
npm --prefix frontend run test:audit
npm --prefix frontend run build
```

Apply only once. If the check fails, stop and resolve the differing base before applying; do not force the patch or use `--reject`. Preserve your local work before updating branches. Restart both servers after the migration and build. No new application dependencies are required.

The migration adds columns and an idempotency index. Rerunning it preserves administrator-edited prices, costs and settings. It expects the existing Phase 6 and wage-register tables to be installed. Back up your database before migration. Automatic destructive rollback is intentionally unavailable.

## Billing configuration

Optional backend `.env` values, read when new invoices are snapshotted:

```dotenv
BILLING_SELLER_NAME=Your business name
BILLING_SELLER_ADDRESS=Your billing address
BILLING_SELLER_TAX_ID=Your tax registration identifier
```

The previous unconditional 18% GST calculation has been removed. Subscription invoices show the captured total and state that no tax breakdown is recorded. Deployment invoices retain the tax amount entered when the invoice was created. This does not implement statutory tax reporting, credit notes, refunds, automatic recurring charges or email delivery of invoices. PDFs use English labels. Marking a deployment invoice paid records its status; it does not transfer money.

Deactivating a plan stops new purchases/redemptions without cancelling existing subscriptions. Editing featured-job permission affects current subscribers immediately. Editing prices/durations does not change already-created payment orders. The monthly duration is configurable; annual duration is fixed at 365 days. Loyalty redemption is candidate-only; Razorpay purchases remain employer-only.

## Verification and limits

Verified on 18 October 2026: **122 backend tests passed, 35 frontend tests passed, and the production build passed.**

Automated verification uses real controllers, routers and JWT authorization with isolated database/payment-provider doubles. Tests cover admin filtering, yearly pricing, renewal time, immutable purchase snapshots, invoice ownership/status transitions, duplicate redemption requests, insufficient balance, transactional rollback, wage-review authorization/version checks, language parity and selection persistence. The Next.js production build includes TypeScript validation.

No live production database or Razorpay transaction was used. The migration must be run against your own database; payment capture and downloads should also be checked with your configured provider. Historical snapshots cannot reconstruct buyer/seller details that were never recorded.

## Manual checks

1. **Superadmin:** Open overview with accounts of different roles. Only admins should appear. Check pagination and active/inactive counts; use Users to manage other roles.
2. **Trainer:** Open courses and use Back to home. Open a quiz and return to courses. A direct admin URL should still redirect to the trainer workspace.
3. **Wages:** Import attendance, enter rates and save. Submit as employer; edits must lock. Return as superadmin with notes, correct and resubmit, then approve. Try reviewing an old open tab and verify a conflict response. Confirm Excel export remains available.
4. **Plans:** Change monthly/yearly price and featured-job permission with a reason. Reload the public pricing page. Verify the amount shown in Razorpay and test featured-job creation with that subscription. Confirm another admin cannot edit plans.
5. **Renewals:** Complete a test-mode yearly purchase; check 365-day duration and invoice. Renew the same plan and verify the remaining time is preserved. Reverify the same payment; it must not extend access again.
6. **Loyalty:** Configure redemption cost, grant a test candidate enough points through existing admin adjustments, redeem and check balance/expiry/ledger. Retry the same request ID; no second deduction. Test insufficient points and disabled redemption.
7. **Languages:** Select Kannada/Tamil, refresh, open another tab and inspect login, subscription, referrals and wage-register screens. Check that names, IDs and amounts remain unchanged. Review translations with native speakers.
8. **Invoices:** Create a deployment invoice, download draft, mark sent then paid, and download again. Attempts to return paid to draft must fail. Another employer must not access its PDF. Download the same invoice as superadmin. Check subscription invoices remain unchanged after plan-price edits.

After these checks, review `git diff`, then commit the source and documentation changes. Keep downloaded patch files out of the commit unless you explicitly want them tracked.
