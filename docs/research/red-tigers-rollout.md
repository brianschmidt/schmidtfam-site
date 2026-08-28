# Red Tigers multi-team rollout

## Key findings

- The existing architecture already models Blue Pumas and Red Tigers as separate tenants. A web magic-link token resolves to one `team_id`; every protected read and write is scoped through that team.
- Sofia's calendar events do not contain `Red Tiger` or `Sofia`. The connected LMFC calendar identifies the team as `2014 Girls Premier`, yielding 41 future events for Fall 2026.
- Thirty-eight events have specific times and are suitable for the carpool board. Three are all-day placeholders and remain in `needs_review` until the calendar supplies actionable times.
- The shared frontend can remain at `/carpool/`. Team name, colors, mascot, schedule, addresses, comments, signups, and calendar feed are selected by the secret rather than the public path.
- Browser-owned edit credentials must be namespaced by team. Otherwise, opening the second team's link can prune the first team's local edit tokens.

## Pricing and limitations

- This expansion uses the existing GitHub Pages, Supabase, and Google Calendar setup and does not add a new paid service.
- The Red Tigers calendar data is currently a connector-derived snapshot, like the initial Blue Pumas load. Automated Google Calendar reconciliation remains a follow-up.
- Google Calendar subscription refresh timing is controlled by the subscriber's calendar client; changes to drivers may not appear immediately.
- Magic links are capability credentials. Anyone with the complete URL can read and write that team's board, so each team's link must be shared only with its parents.
- All-day tournament placeholders are deliberately excluded because a carpool slot without a specific departure time is ambiguous.

## Code snippets for integration

The team rule preserves the source calendar's actual naming:

```sql
insert into private.calendar_rules (
  team_season_id,
  calendar_source_id,
  match_kind,
  match_value
)
values (..., ..., 'title_contains', '2014 Girls Premier');
```

The frontend keeps edit credentials isolated while still using one application:

```js
function getTeamStorageKey(baseKey) {
  return activeTeamSlug ? `${baseKey}:${activeTeamSlug}` : baseKey;
}
```

Parent-facing titles retain the source ID but replace the league roster label:

```sql
case
  when team_slug = 'red-tigers'
    then replace(source_title, '2014 Girls Premier', 'Red Tigers')
  else source_title
end
```

## Next steps

1. Publish the tenant-aware frontend and migration source to GitHub Pages.
2. Test the Red Tigers magic link on a phone and share it only with Sofia's team parents.
3. Confirm exact times for the three all-day tournament placeholders before exposing them as carpool events.
4. Implement the shared calendar synchronization job so both rules are reconciled automatically from the same source calendar.
