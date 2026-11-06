# Structured plan attributes

Built on `phase7` commit `3d824c8` (Add phase7 business updates). Apply this follow-up patch once; do not reapply the business-updates patch.

## What changed

Both internal admins and superadmins can manage a typed plan catalog. Internal admins use `/admin/plans`; superadmins use their existing Plans page. Staff-role and infrastructure permissions remain unchanged. All changes require a reason and write an audit entry in the same transaction.

The catalog has one shared definition for each attribute. Plan cards use those definitions instead of free-text perk lists. Existing perk strings remain in the database for compatibility but are no longer displayed as the new pricing cards' benefits.

| Attribute | Type | Backend behavior |
| --- | --- | --- |
| Monthly price | Money, stored as integer paise | Existing monthly checkout uses this price |
| Yearly price | Money, stored as integer paise | Existing yearly checkout uses this price |
| Monthly duration | Whole number, 1–365 days | Existing monthly purchases/redemptions use this duration |
| Loyalty redemption cost | Nonnegative whole number | Existing redemption uses this cost; zero disables redemption |
| Featured jobs | Yes/No | Existing featured-job permission uses this value |
| Number of resumes allowed | Nonnegative whole number or Unlimited | Resume creation counts the account's saved builder resumes and rejects requests at the limit |
| Custom attribute | Whole number, Yes/No, or text | Validated, saved and displayed consistently; does not automatically implement a new application feature |

Price and other existing system attributes retain their original database columns. They are not duplicated into the custom JSON values. One attribute registry provides labels, types, defaults and validation to admin forms and public plan cards. Resume creation and subscription entitlements share the resume-limit resolver.

## Adding and editing

1. Open **Plans & attributes**.
2. Add an attribute with a unique key, label, type, optional unit, initial value, and reason. For example: key `supportChannel`, label `Support channel`, type Text, initial value `Email`.
3. The server initializes it on every plan atomically. Change its value separately on each plan card, for example `Email` on Free and `Priority support` on Premium.
4. Edit a custom attribute's label/unit once to change its presentation across all plans. Keys, types and initial defaults are immutable after creation to avoid reinterpreting existing data. System attribute definitions are fixed, while their per-plan values are editable.
5. Save each plan with a reason. Stale plan timestamps or a changed set of attribute keys produce a conflict and require reloading.

Custom attributes do not execute arbitrary code or create new feature gates. To enforce a future attribute such as a job-posting limit, add a server-side implementation tied to its stable key; otherwise it remains a displayed plan detail. Free-plan prices and redemption cost must remain zero. Paid prices must be at least INR 1. Negative/fractional quotas, wrong types, unknown attributes and incomplete attribute sets are rejected.

## Resume limits

All saved Resume Builder records count, including drafts and published resumes. The single profile-uploaded CV attachment is a different record and is not counted. The limit is a concurrent saved-record capacity, not a monthly usage allowance. Deleting a saved builder resume frees a slot.

The migration preserves current behavior by treating missing limits as **Unlimited**. Configure each plan explicitly after installation; for example Free = 1, Standard = 3, Premium = 10, Enterprise = Unlimited. These are examples, not seeded business rules. Zero blocks new builder resumes. Existing resumes are never deleted when a limit is reduced; they remain editable and accessible.

Expired subscriptions use the Free plan's limit. Deactivating a paid plan does not remove benefits already purchased. Limits and featured-job access are live plan settings; prices and purchase duration already saved on payment orders remain snapshots. Purchases remain employer-only and point redemption candidate-only, as in the preceding patch; this patch does not add a candidate checkout flow.

Creation locks the authenticated user's database row, reads the effective plan, counts and creates inside one transaction. Parallel creates therefore cannot both consume the last slot. Default-resume changes roll back if the insert fails. Database/provider test doubles verify the transaction behavior; test against your deployed PostgreSQL instance too.

## Installation — project root in PowerShell

```powershell
Set-Location D:\college\TY-Project\Insta-HR-main
git status
git apply --check .\Phase7-plan-attributes.patch
git apply .\Phase7-plan-attributes.patch
npm --prefix backend run migrate:plan-attributes
npm --prefix backend run test:plan-attributes
npm --prefix frontend run test:i18n
npm --prefix frontend run build
```

Back up the database first and restart both servers after migration. The previous business migration must already have been applied. No new runtime dependencies are required. If the patch check fails, stop and reconcile the base or local changes instead of forcing the patch.

The new migration adds `subscription_plans.attributeValues` and the `plan_attributes` table. It is rerunnable, does not reset configured values, and does not drop existing data. Missing schema is not silently ignored by the catalog. Attribute changes and plan saves share a PostgreSQL transaction-scoped advisory lock to serialize concurrent schema edits.

## Validation and manual checks

Verified on 24 October 2026: **133 backend tests passed, 36 frontend tests passed, and the Next.js production build/TypeScript passed.**

Automated checks also include i18n key/placeholder parity across EN/HI/MR/KN/TA, and clean-base patch application. New cases cover types, duplicate keys, defaults on all plans, metadata edits, canonical prices, stale schema/version conflicts, audit rollback, quota races, expiration, zero/unlimited, and failed-insert rollback. Public-card tests cover structured limits, false flags and unchanged authored values. Real router/JWT tests verify admin/superadmin access and denial for candidate/employer/trainer roles.

Manual checks:

- As admin, create `supportChannel`, change its values on different plans, then rename its label. Verify identical labels and correct individual values on public pricing cards after refresh.
- Set a resume limit to 1. Create one builder resume and attempt a second, including from two tabs. Confirm the backend rejects it. Delete the first and retry.
- Reduce a limit below an account's existing count. Confirm existing records remain usable, and new creation is blocked.
- Set zero and Unlimited and verify both behaviors. Expire a paid account and verify Free-plan limits apply.
- Open two admin tabs, change a plan in one and save the old version in the other. Confirm a conflict. Add an attribute in one tab and save a plan with the old schema in the other; reload is required.
- Change monthly/yearly prices and featured-job access; verify checkout amounts and featured-job creation. Confirm candidates cannot mutate the catalog.
- Switch languages and refresh. System copy is translated; custom labels, units and authored values are preserved as entered.

Live database migrations and payment-provider transactions were not run against your production environment.
