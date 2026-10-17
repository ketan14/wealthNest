# WealthNest Supabase Database Directory

This directory contains version-controlled database migrations and pgTAP tests for WealthNest PostgreSQL schemas.

## Structure
- `migrations/`: SQL migration files ordered sequentially by timestamp (YYYYMMDDHHMMSS_name.sql).
- `tests/`: pgTAP unit and regression tests executed via `supabase test db`.

## Guidelines
- Do not run or require a local Supabase instance during Phase 0.
- When Supabase is introduced in subsequent phases, run `supabase start` and `supabase db reset`.
- Domain models in `packages/domain` MUST remain decoupled from auto-generated database types.
