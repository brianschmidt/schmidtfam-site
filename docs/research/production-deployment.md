# Blue Pumas production deployment

## 1. Key findings

- Keep the frontend in the existing `brianschmidt/schmidtfam-site` repository and publish it through the site's existing GitHub Pages custom domain.
- The repository already contains `CNAME` with `schmidtfam.co`, `.nojekyll`, and static root content. A `bluepuma/index.html` folder will therefore publish at `https://schmidtfam.co/bluepuma/` without an additional DNS record.
- Rename the current prototype directory from `carpool/` to `bluepuma/` before merging it into the Pages publishing branch. Its relative CSS, JavaScript, and image references will continue to work.
- GitHub Pages is a static host. It can serve the interface but cannot safely store shared signups, run the hourly Google Calendar sync, or generate a live ICS response.
- Use Supabase as the backend for this project: Postgres for events/signups/sync state, Edge Functions for schedule and signup APIs plus the ICS response, and Supabase Cron to invoke the calendar sync hourly.
- Keep the browser free of Google OAuth credentials and Supabase service-role credentials. The calendar-sync function is the only component that reads the LMFC source calendar.
- `https://schmidtfam.co/bluepuma/` is publicly fetchable and guessable. `noindex` and `robots.txt` discourage discovery but are not access control.
- To retain the stated “possession of the URL” access model, the shareable team link should include a random team token, for example `https://schmidtfam.co/bluepuma/?access=<random-token>`. The backend validates a hash of that token before returning schedule data or accepting signups.
- Use a separate unguessable token for the ICS subscription URL so it can be revoked without invalidating the website link.

Recommended production flow:

```text
https://schmidtfam.co/bluepuma/?access=<team-token>
              │
              ├── static HTML/CSS/JS from GitHub Pages
              │
              └── HTTPS requests to Supabase Edge Functions
                         ├── schedule + shared signups
                         ├── create/edit/cancel signup
                         ├── URL-gated calendar.ics
                         └── hourly LMFC calendar sync
                                      │
                                      └── Supabase Postgres
```

## 2. Pricing and limitations

### GitHub Pages

- Existing custom-domain hosting can remain on GitHub Pages at no additional infrastructure cost.
- GitHub Pages publishes static HTML, CSS, and JavaScript; it does not run application servers or scheduled jobs.
- Pages sites are publicly accessible. A private repository does not make the published site private.
- A URL path such as `/bluepuma/` is handled by the existing Pages site and does not require a DNS change. DNS is only needed for a different hostname such as `bluepuma.schmidtfam.co`.

### Supabase

- The current Free plan includes a 500 MB Postgres database, 5 GB egress, and 500,000 Edge Function invocations, which is ample for a single team prototype.
- Free projects can pause after one week of inactivity and do not include automatic backups. That is acceptable for initial testing but is a reliability limitation.
- The current Pro plan starts at $25 per month and avoids project pausing, adds seven-day daily backups, and increases included capacity.
- A Supabase custom domain is not needed because the browser and ICS client can call the standard project function URL. Supabase currently lists custom domains as an additional paid feature.
- URL tokens are bearer credentials: anyone who receives one can use it. Store only token hashes in the database, use high-entropy values, allow rotation, apply rate limits, and never commit live tokens to Git.
- Because the MVP has no identity system, editing a signup from a different browser will require the administrator or a later recovery flow.

Official references:

- [GitHub Pages is static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions/quickstart)
- [Supabase pricing](https://supabase.com/pricing)

## 3. Code snippets for integration

Proposed published directory:

```text
schmidtfam-site/
├── CNAME                       # schmidtfam.co
├── .nojekyll
├── index.html
├── sofia/
└── bluepuma/
    ├── index.html
    ├── app.js
    ├── styles.css
    └── assets/
        └── blue-puma-logo.png
```

The frontend reads the team token from the shared URL and sends it only to the backend:

```js
const accessToken = new URLSearchParams(location.search).get("access");

const response = await fetch(`${API_BASE}/schedule`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

if (!response.ok) {
  showInvalidOrExpiredLink();
}
```

The ICS Edge Function returns calendar content rather than HTML:

```ts
Deno.serve(async (request) => {
  const token = new URL(request.url).searchParams.get("access");
  const team = await requireCalendarToken(token);
  const events = await loadUpcomingEventsWithSignups(team.id);

  return new Response(buildIcs(events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=blue-pumas-carpool.ics",
      "Cache-Control": "private, no-cache, max-age=300",
    },
  });
});
```

Supabase Cron can invoke the calendar synchronization function hourly:

```sql
select cron.schedule(
  'sync-blue-pumas-calendar',
  '17 * * * *',
  $$
    select net.http_post(
      url := 'https://PROJECT_REF.supabase.co/functions/v1/sync-blue-pumas',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer FUNCTION_SECRET'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

The real function secret must be stored in managed server-side secrets or Vault rather than embedded directly in checked-in SQL.

## 4. Next steps

1. Confirm the architecture: GitHub Pages frontend at `/bluepuma/` plus a Supabase backend.
2. Create a Supabase project, initially on the Free plan for development.
3. Add checked-in database migrations for `teams`, `source_events`, `carpool_signups`, and `calendar_sync_state`.
4. Add Edge Functions for schedule reads, signup creation/edit/cancellation, ICS output, and Google Calendar synchronization.
5. Configure the Google OAuth client and server-side refresh token for the LMFC calendar.
6. Add the hourly Supabase Cron job and sync monitoring.
7. Replace the frontend's static schedule and `localStorage` signups with the backend API.
8. Rename `carpool/` to `bluepuma/`, retain `noindex`, and add invalid/expired-link handling.
9. Test the complete flow against a development Supabase project.
10. Commit the branch, merge to the GitHub Pages publishing branch, push, and verify `https://schmidtfam.co/bluepuma/` plus the ICS subscription on desktop and mobile calendars.
11. Share the tokenized team URL only after shared signup and ICS behavior are verified; do not distribute the static-localStorage prototype as the production scheduler.
