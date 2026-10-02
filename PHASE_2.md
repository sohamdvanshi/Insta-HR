# Phase 2

All changes belong on phase-2-changes. No production emails or money transfers are performed by installing this commit.

## Included
- Employer AI results now read the persisted aiScore, aiSummary, matchedSkills and missingSkills used by candidate applications. Viewing results never re-scores the candidate profile. Pending/failed screenings have no numeric score. Existing screened applications need no backfill; rescreen through the existing application API when desired.
- Referral tracking excludes resume text, internal notes and AI raw responses. Admin and super_admin can recover missing rewards for hired applications. Existing awardReferralReward retains row-lock and duplicate-credit protection.
- Referrer/applicant campaigns have job/status scoping, deduplication, templates, individualized balances, admin access and atomic draft claiming. Failed or interrupted campaigns cannot be automatically resent. A process crash can leave status sending: reconcile provider logs before creating a replacement. This is a synchronous MVP, not a durable delivery queue.
- Encrypted bank profiles, consent, manual review evidence, audited bank access, point reservations, idempotent redemption requests, rejection refunds and recording external bank-transfer references.

## Setup
Stop the backend and back up the database before applying migrations. Run your existing Sequelize migration runner against backend/migrations/20261002000100-phase2-referral-payout.js. The migration tolerates tables previously created by the repository's existing automatic schema sync. Destructive rollback is intentionally disabled.

Configure these backend environment variables (do not commit real values):
- PAYOUT_ENCRYPTION_KEY: 64 hexadecimal characters (32 random bytes). Example generation: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))". Back up the key securely; changing it without re-encryption makes stored banking data unreadable.
- LOYALTY_POINT_VALUE_PAISE: an explicit approved conversion policy. Redemption is disabled until this is configured.
- LOYALTY_REDEMPTION_MIN_POINTS: positive integer, default 100.
- Existing SMTP/email and authentication settings remain required.

Run: node --test backend/tests/phase2.test.js

## Workspace
Open /phase-2 (all roles), /admin/referrals (staff), /admin/campaigns (staff), or /referrals/payouts (candidate). Tabs provide referral tracking, manual reward recovery, campaigns and payouts according to role. Employer campaign pages remain compatible; the new workspace exposes referral templates. Lists are capped at 200 referrals/profiles/redemptions and 100 campaigns; the referral API supports page/limit. These caps must be considered when reconciling large datasets.

Payout APIs are mounted at /api/v1/referrals/payouts. Profile submissions reset review; open requests freeze banking edits. Admin profile approval requires the current revision and opaque references to actual out-of-band checks. Redemptions debit/reserve points immediately, and rejection refunds them once in the same transaction as the state change. Amounts use integer paise and snapshot the bank details and conversion rate at request time.

## Deliberate boundaries
Manual approval is not UIDAI/e-KYC verification. No full Aadhaar number or Aadhaar document is collected. Last-four digits do not establish identity; staff must review evidence outside this app and retain opaque references only. A real verification provider must be integrated before describing this as electronic Aadhaar verification.

No payment provider is connected. Staff must execute an actual bank transfer outside the app before recording paid with its reference. That reference is an administrative assertion, not independently verified settlement. Review approval is operational MVP eligibility, not a statement of legal compliance. Before production, review retention/deletion, key rotation, provider integration, migration/sync policy and access controls.

## Validation
Utility tests cover integer checks, staff roles, template handling and authenticated user-bound encryption. Full PostgreSQL/SMTP/Next.js integration and concurrency tests require the application's environment; they are not claimed to have run here. Test two concurrent redemptions, duplicate request keys, repeated refunds, stale profile reviews, employer cross-job access, campaign duplicate sends and both screening views before deployment.
