import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "postgres";

const allowedOrigins = new Set([
  "https://schmidtfam.co",
  "https://www.schmidtfam.co",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
const icsSigningSecret = getIcsSigningSecret();
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const sql = databaseUrl
  ? postgres(databaseUrl, {
      prepare: false,
      max: 1,
      connect_timeout: 10,
      idle_timeout: 20,
    })
  : null;

function getIcsSigningSecret() {
  const dedicatedSecret = Deno.env.get("ICS_SIGNING_SECRET");
  if (dedicatedSecret) return dedicatedSecret;

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (typeof secretKeys.default === "string") return secretKeys.default;
  } catch {
    // Fall through to the legacy server-only key for older projects.
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function responseHeaders(origin: string | null) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "Vary": "Origin",
  });

  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, content-type");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  }

  return headers;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function signCalendarToken(tokenId: string, teamId: string) {
  if (!icsSigningSecret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(icsSigningSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`ics:v1:${tokenId}:${teamId}`),
  );

  return `v1.${tokenId}.${toBase64Url(signature)}`;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, origin);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders(origin) });
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  const token = match?.[1];

  if (!token || token.length < 32) {
    return jsonResponse({ error: "A valid team link is required" }, 401, origin);
  }

  if (!sql) {
    console.error("SUPABASE_DB_URL is unavailable");
    return jsonResponse({ error: "Schedule service is unavailable" }, 503, origin);
  }

  try {
    const tokenHash = await sha256(token);
    const accessRows = await sql`
      select
        access.id::text as access_token_id,
        team.id::text as team_id,
        team.slug,
        team.display_name,
        team.short_code,
        team.timezone,
        team.page_path,
        team.theme
      from private.access_tokens access
      join private.teams team on team.id = access.team_id
      where access.token_hash = ${tokenHash}
        and access.purpose = 'web'
        and access.revoked_at is null
        and (access.expires_at is null or access.expires_at > now())
        and team.active
      limit 1
    `;

    const access = accessRows[0];
    if (!access) {
      return jsonResponse({ error: "This team link is invalid or no longer active" }, 401, origin);
    }

    const seasonRows = await sql`
      select id::text as id, label, starts_on, ends_on
      from private.team_seasons
      where team_id = ${access.team_id}
        and active
        and (ends_on is null or ends_on >= (now() at time zone ${access.timezone})::date)
      order by
        case
          when starts_on is null or starts_on <= (now() at time zone ${access.timezone})::date then 0
          else 1
        end,
        starts_on nulls first,
        id desc
      limit 1
    `;

    const season = seasonRows[0];
    if (!season) {
      return jsonResponse({ error: "No active team season is available" }, 404, origin);
    }

    const events = await sql`
      select
        team_event.id::text as id,
        source_event.external_event_id as source_event_id,
        source_event.title,
        case
          when source_event.title ilike 'Practice:%' then 'Practice'
          else 'Game'
        end as type,
        source_event.starts_at,
        source_event.ends_at,
        source_event.location,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', slot.id::text,
              'direction', slot.direction,
              'label', slot.label,
              'signupId', signup.id,
              'driver', signup.driver_name,
              'comments', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', slot_comment.id::text,
                    'authorName', slot_comment.author_name,
                    'body', slot_comment.body,
                    'createdAt', slot_comment.created_at,
                    'updatedAt', slot_comment.updated_at
                  )
                  order by slot_comment.created_at, slot_comment.id
                )
                from private.slot_comments slot_comment
                where slot_comment.carpool_slot_id = slot.id
                  and slot_comment.deleted_at is null
              ), '[]'::jsonb)
            )
            order by slot.sort_order
          )
          from private.carpool_slots slot
          left join lateral (
            select active_signup.id::text as id, active_signup.driver_name
            from private.signups active_signup
            where active_signup.carpool_slot_id = slot.id
              and active_signup.cancelled_at is null
            order by active_signup.id desc
            limit 1
          ) signup on true
          where slot.team_event_id = team_event.id
            and slot.active
        ), '[]'::jsonb) as slots
      from private.team_events team_event
      join private.source_events source_event on source_event.id = team_event.source_event_id
      where team_event.team_season_id = ${season.id}
        and team_event.visibility = 'listed'
        and source_event.status <> 'cancelled'
        and source_event.removed_at is null
        and not source_event.all_day
        and (source_event.starts_at at time zone ${access.timezone})::date >=
          (now() at time zone ${access.timezone})::date
      order by source_event.starts_at, source_event.id
    `;

    const addresses = await sql`
      select
        id::text as id,
        child_or_family_name,
        address_text
      from private.pickup_addresses
      where team_id = ${access.team_id}
        and archived_at is null
      order by lower(child_or_family_name), id
    `;

    let calendarFeedUrl: string | null = null;
    if (icsSigningSecret && supabaseUrl) {
      const calendarAccessRows = await sql`
        select id::text as id
        from private.access_tokens
        where team_id = ${access.team_id}
          and purpose = 'ics'
          and revoked_at is null
          and (expires_at is null or expires_at > now())
        order by id desc
        limit 1
      `;
      const calendarAccess = calendarAccessRows[0];

      if (calendarAccess) {
        const calendarToken = await signCalendarToken(calendarAccess.id, access.team_id);
        if (calendarToken) {
          const calendarTokenHash = await sha256(calendarToken);
          await sql`
            update private.access_tokens
            set token_hash = ${calendarTokenHash}
            where id = ${calendarAccess.id}
              and token_hash <> ${calendarTokenHash}
          `;
          calendarFeedUrl = `${supabaseUrl}/functions/v1/team-calendar?access=${encodeURIComponent(calendarToken)}`;
        }
      }
    } else {
      console.warn("A server signing secret or SUPABASE_URL is unavailable");
    }

    await sql`
      update private.access_tokens
      set last_used_at = now()
      where id = ${access.access_token_id}
    `;

    return jsonResponse({
      team: {
        slug: access.slug,
        displayName: access.display_name,
        shortCode: access.short_code,
        timezone: access.timezone,
        pagePath: access.page_path,
        theme: access.theme,
      },
      season: {
        id: season.id,
        label: season.label,
        startsOn: season.starts_on,
        endsOn: season.ends_on,
      },
      events: events.map((event) => ({
        id: event.id,
        sourceEventId: event.source_event_id,
        title: event.title,
        type: event.type,
        start: event.starts_at,
        end: event.ends_at,
        location: event.location,
        slots: event.slots,
      })),
      addresses: addresses.map((address) => ({
        id: address.id,
        childOrFamilyName: address.child_or_family_name,
        addressText: address.address_text,
      })),
      calendarFeedUrl,
    }, 200, origin);
  } catch (error) {
    console.error("team-schedule request failed", error);
    return jsonResponse({ error: "The schedule could not be loaded" }, 500, origin);
  }
});
