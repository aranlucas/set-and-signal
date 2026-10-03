# Upstream provenance

Source: https://github.com/dmmulroy/anti-slop

Revision: c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b

Canonical `src/` is vendored in `web/tools/oxlint/anti-slop/`, with the upstream MIT license and nested ESLint Stylistic license/provenance preserved. No intentional source deviations.

The complete canonical src tree, including upstream RuleTester fixtures, is retained. Application Vitest selects src/**/*.test.* only; upstream fixtures are run separately. See docs/anti-slop.md for boundary exceptions and runtime test seams.
