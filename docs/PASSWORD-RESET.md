# Password recovery

Baseline: phase7 commit `eebdd4cfa153cb28739e3e3e445bd4e31e27b2b6`.

The login page already linked to `/forgot-password`, but that route and password-recovery API did not exist. This change supplies `/forgot-password`, `/reset-password`, and public POST endpoints `/api/v1/auth/forgot-password` and `/api/v1/auth/reset-password`. The screens follow the login-page styling and support English, Hindi and Marathi.

## Setup

1. Apply `Phase7-password-reset.patch` to the baseline or a compatible checkout.
2. Set backend `FRONTEND_URL` to the frontend origin, e.g. `http://localhost:3000` in local development or `https://your-frontend.example` in production. Remote origins require HTTPS. Links are built from this configuration, never from the request Host header. Production requires an explicit origin.
3. Configure the existing Gmail mail service using backend `SMTP_USER`, `SMTP_PASS` (Gmail app password), and optional `EMAIL_FROM`. Use your own values; do not commit credentials.
4. Run `npm --prefix backend run migrate:password-reset` against the intended database before restarting the backend. The additive, repeatable migration adds `passwordResetTokenHash`, `passwordResetExpiresAt` and `authVersion` to the existing `Users` table. No dependency installation change is required.
5. Build/restart the frontend and restart the backend using the project's normal commands.

```powershell
git apply --check .\Phase7-password-reset.patch
git apply .\Phase7-password-reset.patch
npm --prefix backend run migrate:password-reset
npm --prefix backend run test:password-reset
npm --prefix frontend run test:password-reset
npm --prefix frontend run test:audit
npm --prefix frontend run test:i18n
npm --prefix frontend run build
```

## Behavior

- Requests return the same generic success notice for eligible, nonexistent, inactive, unverified and Google-only accounts. Recovery applies to active, verified accounts with a password. Google-only accounts continue using Google sign-in; unverified local accounts complete the existing OTP verification flow first.
- Links contain a cryptographically random 256-bit token in the URL fragment. Fragments are not sent to the web server or in HTTP Referer headers. Only a SHA-256 digest and expiry are stored in the database. Tokens are not returned by the API.
- Links expire after 15 minutes. The account has a one-minute request cooldown. A later issued link replaces the previous link. Each recovery endpoint limits requests to 10 per IP in 15 minutes using the existing express-rate-limit dependency; limits are held per backend process.
- New passwords require at least eight characters and at most 72 UTF-8 bytes, preventing silent bcrypt truncation. A transaction and row lock ensure concurrent submissions can consume a token only once.
- Successful reset hashes the new password, clears the reset fields and increments `authVersion`. Existing JWTs are rejected on subsequent protected requests. New login, Google login and verification tokens include the current version. Existing tokens without a version continue working for accounts that have not reset their password.
- Reset does not log a user in automatically, verify an unverified email or reactivate a disabled account. The page directs the user back to login.
- Failed email delivery removes the undelivered token without disclosing account existence. Configuration/delivery failures are logged on the backend; the generic success notice is not a delivery guarantee.

## Verification and manual test

Backend tests exercise real Express routes with database/email doubles: account privacy, token digest and URL, cooldown, expiry, password validation, one-time concurrency, session revocation, new-password login, rollback, rate limiting and repeatable migration. Frontend tests render the localized pages and exercise the actual form handlers for request submission, mismatched passwords, successful reset and missing tokens. Existing audit/i18n checks and the production build are also run.

For the live check, sign in using a verified local account, request a reset from the login link, open the received email, set a new password and confirm login succeeds with the new password while the old password and old authenticated session fail. Reusing the link must fail. Test unknown emails, expiry, and Google-only accounts; check EN/HI/MR labels. Live SMTP delivery and a real PostgreSQL migration/row-lock interaction remain deployment checks; automated tests mock those services.
