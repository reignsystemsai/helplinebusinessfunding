# HelpLine Business Funding

Static editorial landing page and four-step funding inquiry funnel. Staging copy is marked noindex and every submission is marked is_staging=true.

## Render

Repository: reignsystemsai/helplinebusinessfunding

Build command: `mkdir -p dist && cp index.html config.js dist/ && mkdir -p dist/staging && cp index.html dist/staging/index.html`

Publish directory: `dist`

The staging view is available at `/staging/`. Preview builds must use the same command. The browser config contains only the public anon key; it does not contain a secret or service-role key. Supabase JWT verification remains enabled for submit-lead.

## Data

Project: sjmkvufnmaaqtgjnrpha. Leads are saved through submit-lead into funding_leads. No browser role can read, update, or insert directly into that table. The Edge Function validates input, restricts browser origins, limits submissions per source IP hash, and makes repeated submission of the same request idempotent. IP addresses are stored only as a keyed hash.

This is a request for review, not an underwriting decision. No credit report, bank account number, SSN, or upload is collected. The staging form does not send notifications or automated messages. Before launch, confirm funding partner criteria, legal business identity, contact/privacy details, and any speed or amount claims; remove the staging label/noindex and set the production submission flag as appropriate.
