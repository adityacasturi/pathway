# Invite-Code Flow (replace link-based invite verification)

Status: approved (2026-05-13)

## Goal

Replace the current link-based invite verification with a 6-digit code that the invited user types into `/login`. This eliminates a class of "Email link is invalid or has expired" failures caused by email-security scanners that pre-fetch invite URLs and consume the underlying OTP before the human clicks.

## Background

Today, invites flow through `app/auth/confirm/route.ts`: Supabase emails a link containing a `token_hash`, the route calls `supabase.auth.verifyOtp({ type, token_hash })`, writes session cookies, and redirects to `/set-password`. The route is correct, but the link itself is vulnerable to anti-phishing scanners (Gmail, Outlook, Cloudflare Email Security, etc.) that fetch every URL in inbound mail. That fetch redeems the OTP. When the human later clicks, Supabase returns "Email link is invalid or has expired."

A code-based OTP cannot be consumed by a passive URL fetch and is the documented Supabase mitigation. The OTP itself already exists — it is the `{{ .Token }}` variable in Supabase email templates — but Pathway's current template uses `{{ .ConfirmationURL }}` / `{{ .TokenHash }}` and does not surface the code. The signup OTP UI in `app/login/page.tsx` already accepts a 6-digit code via `verifyEmailOtp`, so most of the plumbing exists.

## Non-goals

- Re-enabling public signup. `SIGNUPS_ENABLED` stays `false`.
- A new database table for invites or codes. Supabase issues and verifies the OTP; we add no schema.
- A self-serve "resend invite code" flow. Supabase does not expose a public API for resending invite OTPs; an admin re-invites from the dashboard if a code expires.
- E2E coverage for the invite flow. Issuing a real invite requires a live Supabase admin call; we keep parity with the existing password-reset posture and rely on manual smoke testing.
- A dedicated `/accept-invite` route. Considered and rejected as more surface area than the problem warrants.

## Approach

Use Supabase's built-in invite OTP. Add one new server action and one inline UI affordance on `/login`. Delete the now-unused link verifier. Update the Supabase email template to surface the code and remove the link.

## Components to change

1. **Supabase email template — Authentication → Email Templates → Invite user.** Replace the body with the code-based template in [Email template](#email-template). Subject becomes "Your Pathway invite code".
2. **Supabase Auth setting — `MAILER_OTP_EXP` = 86400 (24 hours).** This is the Supabase maximum; the platform disallows higher values to guard against brute-force attacks. Configured in the Supabase Dashboard under Authentication → Email.
3. **`lib/actions/auth.ts` — new `verifyInviteOtp` server action.** Mirrors `verifyEmailOtp` but passes `type: "invite"` to `supabase.auth.verifyOtp`. Rate-limited with `limitServerActionByIp("auth:verify-invite", 8, 60_000)`. Returns `{ status: "authenticated" }` on success; `{ error }` on failure with messages routed through `formatAuthError`.
4. **`app/login/page.tsx` — new `"invite"` mode.** Adds a third value to the existing `mode` state alongside `"login"` and `"signup"`. Entry point is a small "Have an invite code?" link rendered beneath the sign-in form when `!otpEmail`. The invite mode renders two inputs (email + 6-digit code) and a "Verify and continue" button, styled to match the existing post-signup OTP branch. On success, client navigates to `/set-password`.
5. **Cleanup — delete `app/auth/confirm/route.ts`.** Remove `/auth/confirm` from the public-routes allowlist in `proxy.ts`. No callers remain inside the app; the only caller was the email link being removed.

## Data flow

1. Admin clicks **Invite user** in the Supabase Dashboard. Supabase creates an unconfirmed row in `auth.users` and emails the user a 6-digit code (TTL 24h).
2. The user opens `https://www.trypathway.app/login`, clicks **Have an invite code?**, types their email and the 6-digit code.
3. The client calls `verifyInviteOtp(formData)`. The server action calls `supabase.auth.verifyOtp({ email, token, type: "invite" })`. On success, the Supabase SSR client writes session cookies on the response.
4. The client receives `{ status: "authenticated" }` and routes to `/set-password`.
5. `/set-password` reads the session, accepts a password, calls `setPassword` (existing action), and redirects to `/home`.

No other routes change. `proxy.ts` already redirects authenticated users away from `/login` and `/`, so a redeemed invite cannot land on a public page.

## Error handling

- **Invalid or expired code** — `verifyOtp` returns a Supabase auth error; `formatAuthError` produces the user-facing message. Expired codes have no automated recovery: the UI tells the user to ask their inviter for a new code.
- **Wrong email** — same path as invalid code.
- **Code already used** — same path as invalid code.
- **Server / Supabase outage** — `formatAuthError` returns the "temporarily unavailable" copy for 5xx responses.
- **Rate limit breach** — `limitServerActionByIp` returns its standard error string; UI surfaces it inline.
- **Authenticated user reaches the invite UI** — `proxy.ts` redirects to `/home` before the page renders.

## UI specifics

- The `"invite"` mode reuses the page chrome and motion variants used by the existing OTP branch.
- Title: **Enter your invite code**. Subtitle: **Use the 6-digit code we emailed you.**
- Email input: standard email input, no `@uw.edu` pattern restriction (invitees might not be on uw.edu yet).
- Code input: `inputMode="numeric"`, `pattern="\d{6}"`, `maxLength={6}`, `autoComplete="one-time-code"`, center-aligned monospace styling matching the existing OTP input.
- Submit button: **Verify and continue**; disabled until the code is exactly 6 digits.
- Secondary actions: **Back to sign in** (clears state, returns to login mode). No resend button.
- Helper copy beneath the form: "Didn't get a code, or has it expired? Ask the person who invited you to send a new one."

## Testing & rollout

- **Manual smoke test (required):** admin invites the developer from the Supabase dashboard; developer types the code on `/login`; lands on `/set-password`; sets a password; lands on `/home`. Re-run with a deliberately wrong code and with a 25-hour-old code to confirm error copy.
- **`npm run verify`** must pass.
- **Rollout** is a single change: the new code, the email-template swap, the `MAILER_OTP_EXP` change, and the deletion of `/auth/confirm` ship together. Any invites issued before the change carry expired tokens and must be re-issued by the admin.

## Email template

Subject: `Your Pathway invite code`

Body (HTML; lives in Supabase Dashboard → Authentication → Email Templates → **Invite user**):

```html
<h2>Welcome to Pathway</h2>
<p>You've been invited to join Pathway. Use the code below to finish setting up your account.</p>
<p style="font-size: 28px; font-weight: 600; letter-spacing: 0.4em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 24px 0;">
  {{ .Token }}
</p>
<p>
  Go to <a href="{{ .SiteURL }}/login">{{ .SiteURL }}/login</a>,
  click <strong>Have an invite code?</strong>, and enter this code along with your
  email address ({{ .Email }}).
</p>
<p>This code expires in 24 hours. If it expires, ask the person who invited you to send a new one.</p>
```

The link in the template is intentionally inert — it opens `/login` and does no verification. A scanner fetching it cannot consume the OTP.

## Security notes

- The 24-hour TTL is the Supabase platform maximum. Brute force is bounded by the existing per-IP rate limit on `auth:verify-invite` (8 attempts per minute).
- No new service-role usage. The new server action uses the standard SSR client.
- Removing `/auth/confirm` removes a server endpoint that consumed a token from a URL parameter; nothing depends on it.

## Open questions

None.
