# Security Policy

TutorBench is a public Developer Preview. Please treat a possible security
issue separately from a disagreement about a benchmark case, rubric, score,
or methodology.

## Report privately

Use GitHub Private Vulnerability Reporting for security issues:

https://github.com/shuangyan123/tutorbench/security/advisories/new

Do not put credentials, tokens, cookies, private artifacts, exploit details,
or other sensitive security evidence in a public GitHub issue.

Private reports are especially appropriate for:

- Credential leaks or secret exposure.
- Unsafe external endpoint or URL handling.
- A bypass of the public-data or private-artifact firewall.
- Leakage of evaluator-only evidence or hidden Judge reasoning.
- Code execution, path traversal, injection, authentication, authorization,
  or other security bugs.

If a secret may already be exposed, revoke or rotate it first when possible,
then report the issue privately without repeating the secret unnecessarily.
Include only the minimum evidence needed to reproduce and assess the issue.

## What is not a security vulnerability

Ordinary benchmark disagreement, an incorrect case, a rubric proposal, a
Judge-quality concern, or a request to change scoring belongs in the relevant
structured issue form or pull request. Do not use a public issue for sensitive
security evidence.

## Maintainer response

Maintainers will validate the report, limit disclosure, and coordinate a fix
or mitigation when appropriate. A report may be closed as non-security scope
when it does not affect confidentiality, integrity, availability, privacy,
or the public-data boundary.
