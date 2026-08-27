# GitHub publishing progress

## Repository state

- Remote: `https://github.com/brianschmidt/schmidtfam-site.git`
- Feature branch: `codex/carpool-scheduler`
- Production branch: `main`
- Custom domain: `schmidtfam.co`
- Static carpool entry point: `/carpool/index.html`

## Status

- [x] Confirmed the repository, custom-domain file, and existing static-site structure.
- [x] Scanned the carpool frontend, Supabase functions, migrations, and notes for committed credentials; no raw team token or server secret is present.
- [x] Confirmed Git push access with a dry run.
- [x] Rebased the feature branch onto the latest `origin/main`, preserving the remote custom-domain configuration.
- [x] Run final syntax and staged-content checks.
- [x] Commit and push `codex/carpool-scheduler`.
- [ ] Merge into `main` to publish `https://schmidtfam.co/carpool/` through the existing GitHub Pages site.

## Publishing note

Pushing the feature branch does not change the production site. GitHub Pages will receive the carpool directory only after the branch is merged into `main`.
