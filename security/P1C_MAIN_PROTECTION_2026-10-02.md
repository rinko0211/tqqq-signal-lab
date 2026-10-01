# P1c Main Protection — 2026-10-02

Status: IMPLEMENTED IN REPOSITORY / PLATFORM RULESET PENDING

## Objective

Protect `main` as the code/config/policy plane after the P1b operational-state cutover.

`ops-state` remains the authoritative runtime-state branch and must not receive the same protection rules, because Daily / Phase 5 / Lifecycle / Human Approval persist validated operational state there.

## Repository-enforced gate

Workflow: `.github/workflows/p1c-main-protection.yml`

Stable required check name:

- `P1c Main Protection`

The gate is read-only and runs for pull requests targeting `main`.

It enforces:

1. runtime state under `github-pages/public/data/**` cannot be changed by a main PR;
2. P1c security-contract tests pass;
3. the full core regression passes;
4. the integrated Pages build passes;
5. validation itself leaves no tracked changes;
6. all external GitHub Actions remain immutable-SHA pinned through the permanent security regression.

## Target GitHub ruleset

Create one branch ruleset targeting only `main`.

Recommended settings for this single-maintainer repository:

- Enforcement: Active
- Target branch: `main` only
- Bypass actors: none
- Restrict deletions: enabled
- Block force pushes: enabled
- Require a pull request before merging: enabled
- Required approving reviews: 0
- Require status checks to pass: enabled
- Required status check: `P1c Main Protection`
- Require branches to be up to date before merging: enabled
- Require linear history: enabled

Do not require one approving review while the repository has only one maintainer; a PR author cannot self-approve and that would deadlock normal maintenance.

Do not apply this ruleset to `ops-state`.

## Security effect

After the platform ruleset is active:

- scheduled operational workflows cannot mutate `main`;
- a direct human push to `main` is rejected;
- force pushes and branch deletion are rejected;
- runtime state cannot be smuggled back into `main` through a PR;
- every code/config/policy change is visible as a PR and must pass the stable P1c gate;
- `ops-state` remains separately writable only by the four validated operational persist jobs.

## Remaining boundary

This phase does not grant broker authority, Production authority, or secret access.

`platformMode` remains RESEARCH unless the explicit Human Production Approval process is separately invoked.
