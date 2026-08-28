# Red Tigers rollout progress

## Scope

- Preserve the shared `/carpool/` application and use each team's magic-link token as the authoritative tenant selector.
- Remove only Blue Pumas test participation data: active driver signups, slot comments, and pickup addresses. Preserve events, calendar rules, team configuration, and access credentials.
- Activate Sofia's Red Tigers board from the same LMFC calendar using future events containing `2014 Girls Premier` in their source title.
- Present those events under the parent-facing Red Tigers identity while retaining the original Google event IDs for future synchronization.

## Verified starting state

- Blue Pumas: 28 events, 2 active signups, 3 visible comments, and 1 active pickup address.
- Red Tigers: tenant and season already exist; no events or participation data are loaded.
- The connected LMFC calendar contains 41 future `2014 Girls Premier` events from August 31 through November 21, 2026.
- No future calendar events contain `Red Tiger` or `Sofia`; `2014 Girls Premier` is therefore the source match for Sofia's team.

## Status

- [x] Resolve team records, cleanup counts, and the Sofia calendar filter.
- [x] Generate and save a transparent Red Tiger mascot asset.
- [x] Generalize frontend branding and browser-owned edit storage by team.
- [x] Create and apply the Red Tigers schedule migration.
- [x] Remove the scoped Blue Pumas test participation data from the live board using recoverable cancellation, soft-deletion, and archival.
- [x] Create Red Tigers web and calendar access credentials.
- [x] Verify API isolation, calendar output, and desktop/mobile presentation.
- [x] Publish the tenant-aware frontend and migration source to GitHub on `codex/red-tigers-team`.
- [x] Refine the shared header so team identity, season, and calendar access stay visible while the board title scrolls away.

## Design direction

- Keep the shared board's typography and layout so parents who use both teams learn one interface.
- Blue Pumas retains navy, pool blue, and yellow.
- Red Tigers uses deep plum `#24072F`, tiger red `#F21D2F`, golden yellow `#F5C542`, and cream-white accents.
- The mascot and team colors are the signature identity layer; schedule structure and interaction patterns remain consistent.

## Verification checkpoint

- Blue Pumas API: 28 events, 0 active signups, 0 visible comments, 0 active addresses.
- Red Tigers API: 38 timed events, 0 active signups, 0 visible comments, 0 active addresses.
- Three Red Tigers all-day calendar placeholders are stored as `needs_review` and are intentionally excluded until they have usable times.
- Red Tigers calendar feed: 38 events, `Red Tigers Carpool` name, and `RT` summaries.
- Mobile and desktop previews show the Red Tiger mascot, red/plum theme, parent-facing Red Tigers event titles, and the existing responsive carpool interactions.
- The refined header shows the logo, team name, and season together; the introductory helper sentence has been removed, and the header remains pinned above the schedule on mobile and desktop.
