# Phase 5 — Training, trainers, and classes

Base: GitHub `main` at `05712bd25d084280c407e23640141b12a4c9a33d`.
This patch is independent of the Phase 1 patch and contains no Phase 1 resume or payment changes.

## Apply from your repository root

Use a clean checkout based on main. Keep any earlier Phase 1 work on its existing branch.
Download `Phase5-training.patch` into the repository root, then run in PowerShell:

```powershell
git switch -c phase5-training main
git apply --check .\Phase5-training.patch
git apply .\Phase5-training.patch
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run migrate:phase5
npm --prefix backend run test:phase5
npm --prefix frontend run build
```

The migration uses the existing development database configured in `backend/.env`.
It creates training batches, sessions, trainee attendance, and the enrollment batch column.
It supports a trainer role in older PostgreSQL enum deployments and can safely be rerun.
The migration requires the existing main schema, including `Users`, `Trainings`, and `course_enrollments`.
Schema synchronization on model import has been removed. Database changes are now explicit.
Do not drop/recreate the database to install this patch.

Start the backend and frontend in separate terminals:

```powershell
npm --prefix backend run dev
```

```powershell
npm --prefix frontend run dev
```

Configuration:

- `backend/.env`: existing database settings, `JWT_SECRET`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (optional), and `FRONTEND_URL=http://localhost:3000`.
- Existing Cloudinary settings are required to upload course video/thumbnail files.
- Frontend `NEXT_PUBLIC_API_URL` is optional. Default: `http://localhost:5000/api/v1`.
- Google Fonts used by the existing root layout need internet access during the normal Next build.

## What changed

### Courses and candidate login

- Course creation/editing no longer offers a live-class selector or meeting fields.
- Video uploads are optional, allowing a course to be used with scheduled physical/online sessions.
- Course fields are validated and allowlisted. Ownership and counts cannot be supplied by a client.
- Admins/super admins manage all courses. Trainers manage their own courses; an assigned trainer can access the batches/sessions they teach without gaining another owner's course-edit permissions.
- Public course responses omit video URLs and legacy meeting fields. Enrolled candidates and authorized staff retrieve content through a protected endpoint.
- Password login and OTP verification return candidates to the training page they came from. Both OTP flows save the user and token; trainer login opens `/trainer`.
- The catalog uses real API data and shows actual loading, error, and empty states instead of fake fallback courses.
- Free enrollment is repeatable without duplicate records/counts. Paid courses do not grant access without payment: the training team grants enrollment after arranging payment/eligibility. This phase does not add an online course payment gateway.
- Courses with enrollments, batches, or sessions cannot be deleted; staff can mark them inactive to retain history.

### Trainer accounts

- Dedicated `trainer` role with a training-only desktop/mobile menu and route guard.
- Authenticated trainer API requests are limited to training modules.
- Admin/super admin can create a trainer account in `/admin/training` with an email and password (12–128 characters). Passwords are hashed; no password is returned in API responses or sent by email.
- Admin provides those credentials directly to the trainer. The trainer uses the normal `/login` page.
- Public registration does not allow creating trainer accounts.
- Existing super-admin role assignment also accepts the trainer role.

### Batches and class scheduling

- `/admin/training`: trainer accounts, candidate enrollment, batches, assignment, classes, and attendance.
- `/trainer`: the trainer's owned courses and assigned batches/classes/attendance.
- `/admin/courses`, `/trainer/courses`: course management, plus existing quiz management for course owners.
- Each enrolled candidate can belong to one batch per course. Admin/course owner assigns members and admins assign trainers. Assigned trainers manage the sessions/attendance for their batch.
- Course-wide classes target all enrolled candidates; batch classes target that batch only.
- Physical classes require a location/full address.
- Online classes require a valid HTTP(S) meeting URL. Meet/Zoom/etc. meetings are created with the provider outside Insta-HR; the portal controls class state and access to the supplied URL. This phase does not host video conferencing or create provider meetings through an API.
- Session lifecycle: scheduled → live → completed; scheduled/live can also be cancelled.
- Staff can start a class during its scheduled time, retrieve the meeting link, end/cancel it, and edit a scheduled class. A session's audience cannot be changed after creation; cancel and recreate it instead.
- Scheduling, rescheduling, starting, and cancelling notify eligible candidates by email. Physical invitations include location and date/time; online invitations point to the authenticated portal. Emails format times in IST; portal times use the browser timezone.
- Email failures do not discard a saved session. Delivery results appear in the workspace. Retry pending emails skips successful deliveries for the current details. Newly enrolled/assigned members receive upcoming invitations.
- Existing configured legacy live courses migrate to separate one-hour sessions. Past sessions are completed; future ones are scheduled. Invalid/incomplete legacy schedules remain untouched for staff to finish manually. Migration does not send historical invitations.

### Candidate portal and attendance

- `/training/classes`: the candidate's eligible classes, venue, instructions, state, and own attendance.
- Classes also appear within an enrolled course's detail page.
- Candidate join access requires an active course, active/completed enrollment, matching batch, live online session, and an unexpired session end time.
- Start the provider meeting using the staff link, then start the portal session; candidates refresh My classes and retrieve their join link.
- Staff can mark present, absent, or excused and add notes after the session starts.
- Trainers cannot mark a different trainer's batch. Duplicate or out-of-roster records are rejected. Attendance is saved with one record per session/candidate and historical attendance stays visible if membership changes.

### Production build fixes included

Main's existing `useSearchParams()` pages lacked Suspense boundaries. The patch adds boundaries to jobs, job detail, both OTP routes, and both certificate-verification routes so the production build can prerender. This is included independently of the earlier Phase 1 patch.

## Manual acceptance checklist

1. As admin, open `/admin/courses`. Create a free course with a title, description, and duration. Confirm there is no live-class toggle. Upload a video if testing playback.
2. Open `/admin/training`. Create a trainer account. Log out and log in with its email/password: confirm the trainer lands on `/trainer` and has only training navigation. Direct navigation to hiring/admin/payroll pages should return to the trainer workspace; protected nontraining API calls should be rejected.
3. Log in as admin again. Select the course, create a batch, and assign that trainer.
4. Register/verify two candidate accounts. As one candidate, open the course while signed out, choose Enroll, log in, and confirm return to that course. Enroll in the free course. Repeat enrollment and confirm no duplicate. Verify candidate video playback after enrollment.
5. Enroll the second candidate. As admin, assign only the first candidate to the batch. Confirm the assigned trainer sees the batch/course, but cannot edit the admin-owned course or manage another trainer's batch.
6. Schedule a physical session for that batch. Use a future time and a full address. Confirm the invited candidate receives the location email and sees the class in My classes; the other candidate does not see that batch's session. SMTP credentials must be configured for real delivery.
7. Schedule an online session starting a few minutes ahead, using a real provider meeting link. Before it is live, candidate join access should be denied. At the scheduled time, start the provider meeting and click Start class in the workspace. Refresh the candidate's My classes and click Get join link → Join meeting. Confirm another batch's candidate is denied. End the class and confirm join access is denied.
8. After a class starts, load Attendance, mark the candidate present/absent/excused, save, and reload. Confirm persistence and the candidate's own attendance display.
9. Edit a scheduled class's time/venue; confirm updated email and portal details. Cancel it; confirm cancellation and blocked joining. Try a missing venue, invalid meeting URL, end-before-start, or early Start: each should be rejected.
10. Test a deliberately unavailable SMTP configuration on a test class. The class should stay saved and show failed deliveries. Restore SMTP and Retry pending emails. Confirm delivery; retry again should skip successful recipients.
11. Try an existing paid course. Candidate self-enrollment should explain that the training team must arrange access; no payment is taken. Admin can grant that candidate access after arranging payment.
12. Rerun the migration; it should finish without recreating tables. Run the backend tests and frontend production build.

## Verification performed for this patch

- 13 API/policy tests with real Express routing/JWT middleware and an in-memory ORM/email mocks.
- TypeScript compilation.
- Production Webpack build and prerendering, with the external Google Font temporarily disabled for the offline runner and restored afterward.
- Model definitions/associations load without automatic database synchronization.
- Patch applicability against the exact main base.

A real PostgreSQL migration, Cloudinary upload/playback, SMTP delivery, and external provider meeting need the manual checks above. Those external services were not exercised in this workspace.
