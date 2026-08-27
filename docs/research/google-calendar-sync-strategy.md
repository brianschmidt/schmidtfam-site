# Google Calendar sync strategy

## 1. Key findings

- Use a scheduled incremental sync for the MVP. Run it hourly while the season is active and provide an administrator-only `Sync now` action for urgent corrections.
- A single morning check is too stale for schedule edits made later in the day. Hourly polling is still only about 24 list requests per day for this one source calendar, plus occasional pagination.
- Perform one initial full event sync and persist Google's `nextSyncToken`. Later runs send that token and receive only events changed or deleted since the previous run.
- Apply the case-insensitive `Blue Puma` title filter locally after retrieval. Keep the Google event ID as the stable source key.
- Store carpool signups separately from source-event fields. A time, title, or location change then updates the event without detaching its `To event` and `Home` signups.
- Treat a deleted event—or an event renamed so it no longer matches `Blue Puma`—as removed from the public schedule, but retain its signup records for audit/recovery rather than deleting them.
- When Google returns HTTP `410 Gone`, discard the expired sync token and perform a fresh full reconciliation.
- Generate the website and ICS feed from the synchronized database. The browser should never call Google Calendar directly or contain OAuth credentials.
- Google Calendar push notifications are a later optimization. They require a public HTTPS webhook, send no changed-event body, and use expiring watch channels that must be renewed manually. The webhook still has to trigger an incremental API sync.

Recommended flow:

```text
Hourly scheduler
      ↓
Google Calendar incremental sync
      ↓
Upsert/remove source events by Google event ID
      ↓
Apply local "Blue Puma" filter
      ↓
Database events + independent driver signups
      ├── Website rolling schedule
      └── URL-gated ICS feed
```

## 2. Pricing and limitations

- Google currently states that standard Calendar API use has no additional cost below its daily billing threshold. The published threshold is 1,000,000 requests per project per day.
- Published quotas are 10,000 requests per minute per project and 600 requests per minute per user per project. An hourly single-calendar sync is negligible relative to those limits.
- Google states that pricing above the daily threshold is planned later in 2026, with advance notice. Recheck pricing before production launch.
- The backend needs durable OAuth authorization for an account that can read the LMFC calendar. Store the refresh token only in encrypted server-side secrets.
- Incremental sync tokens can expire or become invalid after related access-control changes; HTTP `410` must trigger a full resync.
- Polling creates up to one hour of source-schedule latency. The administrator `Sync now` path reduces this when a coach announces an urgent correction.
- Push notifications reduce polling latency but add webhook security, duplicate/out-of-order notification handling, expiring channel renewal, and another API fetch after every notification.

Official references:

- [Synchronize resources efficiently](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Get push notifications](https://developers.google.com/workspace/calendar/api/guides/push)
- [Calendar API usage limits and pricing](https://developers.google.com/workspace/calendar/api/guides/quota)

## 3. Code snippets for integration

Illustrative TypeScript for the scheduled worker:

```ts
const SOURCE_CALENDAR_ID = process.env.LMFC_CALENDAR_ID!;

export async function syncBluePumas() {
  const state = await db.calendarSyncState.get(SOURCE_CALENDAR_ID);

  try {
    const result = await fetchAllEventChanges({
      calendarId: SOURCE_CALENDAR_ID,
      syncToken: state?.nextSyncToken ?? undefined,
    });

    await db.transaction(async (tx) => {
      for (const source of result.events) {
        if (source.status === "cancelled") {
          await tx.sourceEvents.markRemoved(source.id);
          continue;
        }

        const matchesTeam = source.summary
          ?.toLocaleLowerCase("en-US")
          .includes("blue puma");

        await tx.sourceEvents.upsert({
          googleEventId: source.id,
          included: Boolean(matchesTeam),
          title: source.summary ?? "Untitled event",
          startsAt: source.start.dateTime,
          endsAt: source.end.dateTime,
          location: source.location ?? null,
          googleUpdatedAt: source.updated,
        });
      }

      await tx.calendarSyncState.save({
        calendarId: SOURCE_CALENDAR_ID,
        nextSyncToken: result.nextSyncToken,
        lastSyncedAt: new Date(),
        status: "ok",
      });
    });
  } catch (error) {
    if (isGoogleGoneError(error)) {
      await db.calendarSyncState.clearToken(SOURCE_CALENDAR_ID);
      await runFullCalendarReconciliation();
      return;
    }

    await recordSyncFailure(error);
    throw error;
  }
}
```

Signups should use the stable source ID plus direction rather than the event date:

```ts
type CarpoolSignup = {
  googleEventId: string;
  direction: "to_event" | "home";
  driverName: string;
};
```

That key keeps the signup attached when the coach moves an existing event to a different date or time.

## 4. Next steps

1. Choose the shared database and scheduled-function host.
2. Authorize a server-side Google OAuth client to read the LMFC calendar and store its refresh token securely.
3. Create `source_events`, `carpool_signups`, and `calendar_sync_state` tables.
4. Implement the initial full sync, incremental token flow, pagination, deletion handling, and HTTP `410` recovery.
5. Schedule the incremental worker hourly at an off-minute such as `17 * * * *` and add an administrator-only `Sync now` action.
6. Serve the rolling website schedule and URL-gated ICS feed from the synchronized database.
7. Add monitoring for `last_synced_at`, consecutive failures, and source events removed while they still have driver signups.
8. Revisit Google push notifications only if one-hour freshness proves insufficient.
