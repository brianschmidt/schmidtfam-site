# Pre-season camp classification progress

## Scope

- Treat source-calendar titles beginning with `Pre-Season Camp` as practices.
- Include those camps on the carpool board and subscribed ICS feed.
- Label the outbound segment `To practice` without changing slot IDs or historical records.

## Status

- [x] Identify the affected source event and slot.
- [x] Update the shared web and ICS classification rules.
- [x] Add a data migration for the slot label.
- [x] Deploy and verify the August 31 camp.
- [ ] Merge and verify production.

## Expected result

- `Pre-Season Camp (Red Tigers)` appears on August 31.
- Its type badge and ICS summary say `Practice`, not `Game`.
- Its outbound segment says `To practice`.
- Red Tigers shows 31 upcoming practices; Blue Pumas remains at 19.

## Verification

- Red Tigers board: 31 upcoming practices, with August 31 shown as `Practice` and `To practice`.
- Red Tigers ICS feed: 31 events, zero game summaries, and the camp summary is `RT Practice - Driver Needed`.
- Blue Pumas board: remains at 19 upcoming practices, with no game or `To event` labels.
- Supabase advisors: no new warnings or errors; existing notices remain informational.
