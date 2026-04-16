# Internship Application Tracker

## Project
Personal single-user internship tracker. Next.js 14, TypeScript, Tailwind, shadcn/ui, Supabase.

## Working style
Check in frequently. Before each meaningful step, explain what you're about to do and wait 
for approval. Don't make large changes silently.

## Principles
- Clean, minimal UI. Linear/Notion aesthetic.
- Security: all DB access through Supabase RLS. Never use service_role key in frontend code.
- Never hardcode secrets. Always use .env.local.

## Stack
- Framework: Next.js 14 (App Router)
- Styling: Tailwind + shadcn/ui
- Auth + DB: Supabase (email/password auth, Postgres)
- Deployment: Vercel

## Data model
applications: id, user_id, company, role, link, date_applied, status, created_at

## Status values
applied | interviewing | offer | rejected

## Do NOT
- Use the Supabase service_role key in frontend code
- Store sensitive data in localStorage
- Skip RLS policies
- Make multiple large changes without checking in
