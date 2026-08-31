# Security policy

Set & Signal is self-hostable software. Please do not publish credentials,
session material, personal training data, or an exploit in a public issue.

## Reporting

For a suspected vulnerability, open a
[private security advisory](https://github.com/aranlucas/set-and-signal/security/advisories/new).
If that channel is unavailable, contact the maintainer privately through the
account that owns the repository and include:

- the affected commit, route, or deployment configuration;
- a concise reproduction and impact assessment;
- any proposed mitigation and whether the report is safe to reproduce.

Allow reasonable time for a fix before public disclosure. Rotate any exposed
OAuth, VAPID, session, database, or OpenRouter credentials immediately.

## Deployment baseline

Use HTTPS for `PUBLIC_URL` and OAuth callbacks, keep `/data` on a private volume,
set a strong invite/admin policy, and never commit `.env` or provider secrets.
The optional OpenRouter feature sends selected prompts to that provider; disable
it when that data flow is not acceptable.
