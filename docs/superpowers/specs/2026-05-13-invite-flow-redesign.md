# Invite Flow Redesign (custom token, click-to-redeem)

Status: approved (2026-05-13). Supersedes `2026-05-13-invite-code-flow-design.md`.

## Why this replaces the OTP design

The OTP-based invite flow we just shipped solves the scanner-prefetch bug but inherits Supabase Cloud's single `MAILER_OTP_EXP` setting, forcing the same TTL on signup confirmation and invite codes. We want a short OTP for signup (security) and a long, self-managed window for invites (usability). The only way out is to stop using Supabase's OTP for invites and run our own redemption layer.

## Goal

Invitations are issued via a small admin page, the recipient clicks a single button in their email, and they land authenticated on `/set-password`. Invite TTL is fully decoupled from `MAILER_OTP_EXP` (default 7 days, configurable in code). The link is scanner-resistant by virtue of requiring a POST to redeem.

## Non-goals

- Re-enabling public signup. `SIGNUPS_ENABLED` stays `false`.
- A multi-admin permissions system. The admin gate is an env allowlist for v1.
- E2E coverage. Manual smoke test, parity with the rest of the auth surface.
- Audit log UI for invite history. The `invites` table is the audit log; we don't render it.

## Approach

A new `invites` table tracks pending invites with a per-row `expires_at`. The admin creates an invite via `/admin/invite`; the server creates the auth user pre-confirmed, inserts an invite row, and emails the user a redemption link. The user clicks **Continue** on `/accept-invite`, which POSTs to a server action; the action atomically claims the invite, mints a fresh Supabase magic link server-side, immediately verifies it server-side to establish a session, and redirects to `/set-password`. Scanners that GET the link see only a confirmation page; nothing is consumed without the POST.

## Components

### 1. Migration `supabase/migrations/043_create_invites.sql`

- Table `public.invites`:
  - `id uuid primary key default gen_random_uuid()`
  - `email text not null` (normalized, stored lowercase)
  - `token_hash text not null unique` (sha256 of the raw token; raw token never persisted)
  - `expires_at timestamptz not null`
  - `redeemed_at timestamptz`
  - `redeemed_by uuid references auth.users(id) on delete set null`
  - `created_at timestamptz not null default now()`
  - `created_by uuid references auth.users(id) on delete set null`
- Indexes: `unique (token_hash)`, partial index on `(email) where redeemed_at is null` for "is this email already invited?" checks.
- RLS: enabled, no policies. The table is reachable only via the service-role client (which bypasses RLS).
- Production integrity check: extend `app_private.production_integrity_check()` with an assertion that `invites` has RLS enabled and no policies.

### 2. Service-role Supabase client `lib/supabase/admin.ts`

- Wraps `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` with `{ auth: { autoRefreshToken: false, persistSession: false } }`.
- Throws at import time if `SUPABASE_SERVICE_ROLE_KEY` is missing — fail fast in dev.
- Used only from server actions. Never imported by client components.

### 3. Admin gate `lib/auth/admin.ts`

- Reads `ADMIN_EMAILS` env var (comma-separated). Empty/missing → no admins.
- `export async function requireAdmin(): Promise<User>` — uses the SSR client to get the current user; throws `unauthorized` error if not signed in or email not in the allowlist; returns the user otherwise.
- `export async function isAdmin(): Promise<boolean>` — non-throwing variant for conditional rendering.

### 4. Email module `lib/email/invite.ts`

- `export async function sendInviteEmail({ email, url, expiresAt }): Promise<void>` — POSTs to `https://api.resend.com/emails` with the `RESEND_API_KEY` (matches the pattern in `lib/actions/waitlist.ts`).
- From address: `Pathway <invites@trypathway.app>` (requires verified Resend domain — see [Operational prerequisites](#operational-prerequisites)).
- Plain-text body included for accessibility / plain-text clients.
- Non-fatal on failure for the create flow: errors are logged and the admin page surfaces a warning ("invite created but email did not send — copy the link manually").

### 5. `/admin/invite` page

- Server component at `app/admin/invite/page.tsx`. Calls `requireAdmin()`; returns `notFound()` on failure (so non-admins can't even probe its existence).
- Renders a form: email input, "Send invite" submit. Below the form, optionally show the most recent 5 invites (email, expires_at, redeemed status) by querying via the service-role client.
- Form posts to `createInvite(formData)`.

### 6. `createInvite` server action `lib/actions/invite.ts`

- Validates admin via `requireAdmin`.
- Rate-limited: `limitServerActionByIp("admin:create-invite", 20, 60 * 60 * 1000)` — 20/hour per admin IP.
- Normalizes and validates email.
- Generates a 32-byte random token (`crypto.randomBytes(32).toString("base64url")`).
- Computes `token_hash = sha256(token)`.
- Calls `admin.auth.admin.createUser({ email, email_confirm: true })`. If `email already exists`, fetches the existing user and proceeds — invites are also a "magic link for existing users" path.
- Inserts `invites` row with `expires_at = now() + INTERVAL_DAYS` where `INTERVAL_DAYS = 7` (constant in `lib/config/invites.ts`).
- Calls `sendInviteEmail({ email, url, expiresAt })` where `url = ${SITE_URL}/accept-invite?token=${token}`.
- Returns `{ ok: true, email, expiresAt }` for the admin page to render.

### 7. `/accept-invite` page

- Server component at `app/accept-invite/page.tsx`. Public route (added to `proxy.ts` allowlist).
- Reads `?token=` from `searchParams`. If absent, shows generic error.
- Hashes the token and queries `invites` via the service-role client. If not found / already redeemed / expired, shows the appropriate error state (with copy: "Already used → Sign in. Expired → Ask your inviter.").
- Otherwise, renders a single-button confirmation: "You've been invited as `<email>`. Continue →". The button is inside a `<form>` that POSTs to `redeemInvite` via a server action.
- If the visitor is already authenticated, redirect them to `/home` (no point continuing).

### 8. `redeemInvite` server action `lib/actions/invite.ts`

- Rate-limited: `limitServerActionByIp("invite:redeem", 8, 60_000)`.
- Reads the token from `formData`, hashes it, then runs an atomic UPDATE:
  ```sql
  UPDATE invites
     SET redeemed_at = now(),
         redeemed_by = (SELECT id FROM auth.users WHERE email = invites.email)
   WHERE token_hash = $1
     AND redeemed_at IS NULL
     AND expires_at > now()
   RETURNING email
  ```
  Zero rows → return appropriate error.
- Calls `admin.auth.admin.generateLink({ type: "magiclink", email })` to get a fresh `hashed_token`.
- Immediately calls `supabase.auth.verifyOtp({ type: "magiclink", token_hash })` from the SSR client to write session cookies on the response.
- Redirects to `/set-password`.
- On any failure after the atomic claim, log the redeemed-but-failed state. Admin can reissue (creates a new row; old row stays redeemed for audit).

### 9. Cleanup of the previous OTP flow

Remove from the working tree (uncommitted):

- `verifyInviteOtp` from `lib/actions/auth.ts`.
- `"invite"` mode, `handleVerifyInvite`, `enterInviteMode`, `exitInviteMode`, and the "Have an invite code?" entry in `app/login/page.tsx`. Restore `mode` to `"login" | "signup"`.
- Restore the corresponding title/subtitle conditionals.

Keep the existing uncommitted change:

- `app/auth/confirm/route.ts` stays deleted.
- `/auth/confirm` stays out of `proxy.ts`.

### 10. `proxy.ts`

- Add `/accept-invite` to the public-routes allowlist (anonymous users hit it).
- `/admin/*` stays gated by the existing authenticated-route logic (`requireAdmin` does the role check inside the page).

## Data flow

1. Admin signs in to Pathway, visits `/admin/invite`, enters an email, submits.
2. `createInvite` validates admin, creates the auth user pre-confirmed (or reuses if exists), inserts an `invites` row with a 7-day TTL, and emails the user a link.
3. User clicks **Set up your account** in the email → opens `/accept-invite?token=<random>`.
4. Page renders confirmation card with "Continue" button. GET does no database mutation.
5. User clicks Continue → POSTs to `redeemInvite`.
6. Server atomically claims the invite, mints + verifies a fresh magic link, writes session cookies, redirects to `/set-password`.
7. User sets a password → `/home`.

## Error handling

| Condition | UI |
| --- | --- |
| Missing/malformed token | "This invite link is invalid." |
| Token not found in DB | "This invite link is invalid." (same copy — no enumeration) |
| Token already redeemed | "This invite was already used. Sign in to continue." + link to `/login`. |
| Token expired | "This invite has expired. Ask the person who invited you to send a new one." |
| User already authenticated when hitting `/accept-invite` | Redirect to `/home`. |
| Magic-link exchange fails after atomic claim | Logged. User sees a generic "Something went wrong" with a "Contact your inviter" hint. Admin reissues. |
| Resend send fails on create | Admin page shows the redemption URL inline with "Email did not send — copy and share manually." |
| Rate limit exceeded | Standard rate-limit error string. |

## UI specifics

- `/admin/invite`: minimal page chrome consistent with the app shell. Email input, primary button, success/error banner. Recent-invites list optional; nice-to-have, low priority.
- `/accept-invite`: matches the polish of `/login`. Logo at the top, card with sage eyebrow ("You've been invited"), serif headline ("Welcome to Pathway"), the recipient's email rendered prominently, single primary button "Continue →". Footer with the small expiry note.
- The email template (HTML, sent via Resend) follows the same skeleton as the invite/confirmation emails we just polished, but with a button instead of a code.

## Email template

Subject: `You've been invited to Pathway`

Body (sent via Resend):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>You've been invited to Pathway</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f4ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1f2a;">
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
      Set up your Pathway account in one click — link expires in 7 days.
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f4ef;">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width: 100%; max-width: 560px;">
            <tr>
              <td align="center" style="padding-bottom: 36px;">
                <img src="https://www.trypathway.app/brand/pathway-logo-black-transparent-600w.png" alt="Pathway" width="148" height="36" style="display: block; border: 0; outline: none; max-width: 148px; height: auto;">
              </td>
            </tr>
            <tr>
              <td style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 44px 40px;">
                <p style="margin: 0 0 12px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #5e8a6c;">
                  You've been invited
                </p>
                <h1 style="margin: 0 0 12px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; line-height: 1.2; font-weight: 500; color: #1c1f2a;">
                  Welcome to Pathway
                </h1>
                <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.55; color: #4b5060;">
                  You've been invited to join Pathway. Click the button below to set up your account.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center">
                      <a href="{{INVITE_URL}}" style="display: inline-block; background-color: #1c1f2a; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500; padding: 14px 28px; border-radius: 10px;">
                        Set up your account &rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 28px 0;">

                <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.55; color: #6b7280;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="margin: 0 0 16px 0; font-size: 12px; line-height: 1.55; word-break: break-all; color: #4b5060;">
                  <a href="{{INVITE_URL}}" style="color: #5e8a6c; text-decoration: none;">{{INVITE_URL}}</a>
                </p>
                <p style="margin: 0; font-size: 13px; line-height: 1.55; color: #6b7280;">
                  This link expires in 7 days. If it expires, ask the person who invited you to send a new one.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top: 28px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">
                  Pathway · <a href="https://www.trypathway.app" style="color: #6b7280; text-decoration: none;">trypathway.app</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

`{{INVITE_URL}}` is replaced at send time with the per-invite redemption URL.

## Operational prerequisites

Before invites can actually send, two manual steps in Resend / DNS:

1. Verify the **trypathway.app** sending domain in the Resend dashboard (add the SPF/DKIM/DMARC DNS records they provide).
2. Confirm sending from `invites@trypathway.app` is allowed under the verified domain.

Two manual steps in env / Supabase:

3. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (and production). It already exists in Supabase project settings; just copy it. Server-side only — must NEVER be prefixed `NEXT_PUBLIC_`.
4. Add `ADMIN_EMAILS=<your-pathway-email>` to `.env.local` (and production). Comma-separated for multiple.

One manual step in Supabase Dashboard:

5. **Set `MAILER_OTP_EXP` back to 3600** (or whatever you want for signup confirmation). The 24h value we set earlier is no longer necessary, since invites no longer use OTP. Update the "Confirm your email" email template copy back to "1 hour" if you set it to 3600.

## Testing & rollout

- **Manual smoke test:** admin signs in, visits `/admin/invite`, invites a fresh email, receives the email, clicks Continue, lands on `/set-password`, sets a password, lands on `/home`. Repeat with: (a) already-redeemed token, (b) expired token (manually update the row), (c) tampered token, (d) admin-allowlist miss (a non-admin user shouldn't be able to load `/admin/invite`).
- **`npm run verify`** must pass.
- **Migration application** via the Supabase connector `_apply_migration` tool, then confirm with `_list_migrations`. Run `app_private.production_integrity_check()`. Review advisors.
- **Rollout:** new flow ships behind no flag. Migration applies, code deploys, admin page becomes available. The old OTP code never made it to a commit, so there's nothing to deprecate.

## Security notes

- **Token entropy:** 32 bytes (256 bits) URL-safe random. Unguessable.
- **Token storage:** only the sha256 hash is stored. DB dump does not yield usable tokens.
- **Service-role key:** server-only. Imported only by code under `lib/` invoked from server actions and server components.
- **Admin gate:** env allowlist; explicit `requireAdmin()` in both the page and the action (defense in depth). Returning `notFound()` on the page denies enumeration.
- **Brute force:** redemption rate-limited 8/min per IP. Search space is 2^256 — brute force is not a meaningful threat.
- **Token exposure in logs:** the redemption URL contains the token in the query string. After successful redemption the token is invalidated (`redeemed_at` set), so any logs are stale by the time they could be replayed.
- **CSRF on `/accept-invite` redeem POST:** the form uses Next.js server actions, which already include CSRF-equivalent protections (encrypted action IDs). No additional token needed.
- **Email-scanner POST:** the redemption endpoint is a server action accepting POST. Modern aggressive scanners (Mimecast, MS ATP advanced threat protection) can in rare cases submit forms. We accept this residual risk — if a redemption is consumed by a scanner before the user, admin reissues. This is much rarer than the GET-prefetch problem and is bounded by the per-recipient nature of the link.

## Open questions

None.
