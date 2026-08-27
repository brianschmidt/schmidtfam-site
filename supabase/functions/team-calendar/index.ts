import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "postgres";

const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
const icsSigningSecret = getIcsSigningSecret();
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

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
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

async function expectedSignature(tokenId: string, teamId: string) {
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
  return toBase64Url(signature);
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function escapeIcs(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const segments: string[] = [];
  let segment = "";
  let limit = 75;

  for (const character of line) {
    if (segment && encoder.encode(segment + character).byteLength > limit) {
      segments.push(segment);
      segment = character;
      limit = 74;
    } else {
      segment += character;
    }
  }
  segments.push(segment);
  return segments.join("\r\n ");
}

function toIcsUtc(value: string | Date) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function eventLabel(access: Record<string, any>, title: string | null) {
  const type = title?.toLowerCase().startsWith("practice:") ? "Practice" : "Game";
  return `${access.short_code} ${type}`;
}

function calendarSummary(access: Record<string, any>, event: Record<string, any>) {
  const slots = Array.isArray(event.slots) ? event.slots : [];
  const drivers = slots.map((slot) => slot.driver).filter(Boolean);
  if (drivers.length < slots.length) return `${eventLabel(access, event.title)} - Driver Needed`;

  const uniqueDrivers = [...new Set(drivers)];
  return `${eventLabel(access, event.title)} - ${uniqueDrivers.join(" + ")} Driving`;
}

function calendarDescription(event: Record<string, any>) {
  const slots = Array.isArray(event.slots) ? event.slots : [];
  return slots
    .map((slot) => `${slot.label}: ${slot.driver || "Driver needed"}`)
    .join("\n");
}

function buildCalendar(access: Record<string, any>, events: Record<string, any>[]) {
  const calendarName = `${access.display_name} Carpool`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Schmidt Family//Team Carpool//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    `X-WR-TIMEZONE:${escapeIcs(access.timezone)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const event of events) {
    const modified = event.last_modified_at || event.starts_at;
    lines.push(
      "BEGIN:VEVENT",
      `UID:team-event-${event.id}-${access.slug}@schmidtfam.co`,
      `DTSTAMP:${toIcsUtc(modified)}`,
      `LAST-MODIFIED:${toIcsUtc(modified)}`,
      `SEQUENCE:${Math.max(0, Math.floor(new Date(modified).getTime() / 1000))}`,
      `DTSTART:${toIcsUtc(event.starts_at)}`,
      `DTEND:${toIcsUtc(event.ends_at)}`,
      `SUMMARY:${escapeIcs(calendarSummary(access, event))}`,
      `DESCRIPTION:${escapeIcs(calendarDescription(event))}`,
      `LOCATION:${escapeIcs(event.location)}`,
      `STATUS:${event.status === "tentative" ? "TENTATIVE" : "CONFIRMED"}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }
  if (!sql || !icsSigningSecret) {
    console.error("SUPABASE_DB_URL or a server signing secret is unavailable");
    return errorResponse("Calendar service is unavailable", 503);
  }

  const token = new URL(request.url).searchParams.get("access") ?? "";
  const match = token.match(/^v1\.(\d+)\.([A-Za-z0-9_-]{43})$/);
  if (!match) return errorResponse("Calendar link is invalid or no longer active", 401);

  try {
    const [, tokenId, signature] = match;
    const accessRows = await sql`
      select
        access.id::text as access_token_id,
        access.token_hash,
        team.id::text as team_id,
        team.slug,
        team.display_name,
        team.short_code,
        team.timezone
      from private.access_tokens access
      join private.teams team on team.id = access.team_id
      where access.id = ${tokenId}
        and access.purpose = 'ics'
        and access.revoked_at is null
        and (access.expires_at is null or access.expires_at > now())
        and team.active
      limit 1
    `;
    const access = accessRows[0];
    if (!access) return errorResponse("Calendar link is invalid or no longer active", 401);

    const expected = await expectedSignature(tokenId, access.team_id);
    const tokenHash = await sha256(token);
    if (!expected || !timingSafeEqual(signature, expected) || !timingSafeEqual(tokenHash, access.token_hash)) {
      return errorResponse("Calendar link is invalid or no longer active", 401);
    }

    const seasonRows = await sql`
      select id::text as id
      from private.team_seasons
      where team_id = ${access.team_id}
        and active
        and (ends_on is null or ends_on >= (now() at time zone ${access.timezone})::date)
      order by
        case when starts_on is null or starts_on <= (now() at time zone ${access.timezone})::date then 0 else 1 end,
        starts_on nulls first,
        id desc
      limit 1
    `;
    const season = seasonRows[0];
    if (!season) return errorResponse("No active team season is available", 404);

    const events = await sql`
      select
        team_event.id::text as id,
        source_event.title,
        source_event.status,
        source_event.starts_at,
        source_event.ends_at,
        source_event.location,
        greatest(
          source_event.updated_at,
          team_event.updated_at,
          coalesce((
            select max(greatest(slot.updated_at, coalesce(signup.updated_at, slot.updated_at)))
            from private.carpool_slots slot
            left join lateral (
              select latest_signup.updated_at
              from private.signups latest_signup
              where latest_signup.carpool_slot_id = slot.id
              order by latest_signup.updated_at desc, latest_signup.id desc
              limit 1
            ) signup on true
            where slot.team_event_id = team_event.id and slot.active
          ), team_event.updated_at)
        ) as last_modified_at,
        coalesce((
          select jsonb_agg(
            jsonb_build_object('direction', slot.direction, 'label', slot.label, 'driver', signup.driver_name)
            order by slot.sort_order
          )
          from private.carpool_slots slot
          left join lateral (
            select active_signup.driver_name
            from private.signups active_signup
            where active_signup.carpool_slot_id = slot.id and active_signup.cancelled_at is null
            order by active_signup.id desc
            limit 1
          ) signup on true
          where slot.team_event_id = team_event.id and slot.active
        ), '[]'::jsonb) as slots
      from private.team_events team_event
      join private.source_events source_event on source_event.id = team_event.source_event_id
      where team_event.team_season_id = ${season.id}
        and team_event.visibility = 'listed'
        and source_event.status <> 'cancelled'
        and source_event.removed_at is null
        and not source_event.all_day
        and (source_event.starts_at at time zone ${access.timezone})::date >= (now() at time zone ${access.timezone})::date
      order by source_event.starts_at, source_event.id
    `;

    await sql`update private.access_tokens set last_used_at = now() where id = ${access.access_token_id}`;

    return new Response(buildCalendar(access, events), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${access.slug}-carpool.ics"`,
        "Cache-Control": "private, no-cache, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("team-calendar request failed", error);
    return errorResponse("The calendar could not be loaded", 500);
  }
});
