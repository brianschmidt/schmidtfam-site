import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "postgres";

const allowedOrigins = new Set([
  "https://schmidtfam.co",
  "https://www.schmidtfam.co",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
const sql = databaseUrl
  ? postgres(databaseUrl, {
      prepare: false,
      max: 1,
      connect_timeout: 10,
      idle_timeout: 20,
    })
  : null;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
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
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
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

function generateEditToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `edit_${base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}

function requiredText(
  value: unknown,
  label: string,
  maximumLength: number,
) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${label} is required`);
  }

  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new HttpError(400, `${label} is required`);
  if (cleaned.length > maximumLength) {
    throw new HttpError(400, `${label} is too long`);
  }
  return cleaned;
}

function requiredCommentBody(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpError(400, "Comment is required");
  }

  const cleaned = value
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
  if (!cleaned) throw new HttpError(400, "Comment is required");
  if (cleaned.length > 500) throw new HttpError(400, "Comment is too long");
  return cleaned;
}

function requiredId(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new HttpError(400, `${label} is invalid`);
  }
  return value;
}

function requiredEditToken(value: unknown) {
  if (typeof value !== "string" || value.length < 32 || value.length > 160) {
    throw new HttpError(403, "This browser cannot edit that record");
  }
  return value;
}

async function authorizeTeam(request: Request) {
  if (!sql) throw new HttpError(503, "Write service is unavailable");

  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  const token = match?.[1];
  if (!token || token.length < 32) {
    throw new HttpError(401, "A valid team link is required");
  }

  const tokenHash = await sha256(token);
  const rows = await sql`
    select
      access.id::text as access_token_id,
      team.id::text as team_id,
      team.slug
    from private.access_tokens access
    join private.teams team on team.id = access.team_id
    where access.token_hash = ${tokenHash}
      and access.purpose = 'web'
      and access.revoked_at is null
      and (access.expires_at is null or access.expires_at > now())
      and team.active
    limit 1
  `;

  if (!rows[0]) {
    throw new HttpError(401, "This team link is invalid or no longer active");
  }
  return rows[0];
}

async function createSignup(teamId: string, body: Record<string, unknown>) {
  if (!sql) throw new HttpError(503, "Write service is unavailable");
  const slotId = requiredId(body.slotId, "Carpool slot");
  const driverName = requiredText(body.driverName, "Driver name", 60);
  const editToken = generateEditToken();
  const editTokenHash = await sha256(editToken);

  const rows = await sql`
    insert into private.signups (
      carpool_slot_id,
      driver_name,
      edit_token_hash
    )
    select
      slot.id,
      ${driverName},
      ${editTokenHash}
    from private.carpool_slots slot
    join private.team_events team_event on team_event.id = slot.team_event_id
    join private.team_seasons season on season.id = team_event.team_season_id
    join private.teams team on team.id = season.team_id
    join private.source_events source_event on source_event.id = team_event.source_event_id
    where slot.id = ${slotId}
      and season.team_id = ${teamId}
      and season.active
      and slot.active
      and team_event.visibility = 'listed'
      and source_event.status <> 'cancelled'
      and source_event.removed_at is null
      and (source_event.starts_at at time zone team.timezone)::date >=
        (now() at time zone team.timezone)::date
    on conflict (carpool_slot_id) where cancelled_at is null do nothing
    returning
      id::text as id,
      carpool_slot_id::text as slot_id,
      driver_name
  `;

  if (!rows[0]) {
    throw new HttpError(409, "That ride already has a driver");
  }

  return {
    status: 201,
    body: {
      signup: {
        id: rows[0].id,
        slotId: rows[0].slot_id,
        driverName: rows[0].driver_name,
      },
      editToken,
    },
  };
}

async function updateSignup(teamId: string, body: Record<string, unknown>) {
  if (!sql) throw new HttpError(503, "Write service is unavailable");
  const signupId = requiredId(body.signupId, "Signup");
  const driverName = requiredText(body.driverName, "Driver name", 60);
  const editTokenHash = await sha256(requiredEditToken(body.editToken));

  const rows = await sql`
    update private.signups signup
    set driver_name = ${driverName}
    from private.carpool_slots slot
    join private.team_events team_event on team_event.id = slot.team_event_id
    join private.team_seasons season on season.id = team_event.team_season_id
    where signup.id = ${signupId}
      and signup.carpool_slot_id = slot.id
      and season.team_id = ${teamId}
      and signup.edit_token_hash = ${editTokenHash}
      and signup.cancelled_at is null
    returning
      signup.id::text as id,
      signup.carpool_slot_id::text as slot_id,
      signup.driver_name
  `;

  if (!rows[0]) {
    throw new HttpError(403, "This browser cannot edit that signup");
  }

  return {
    status: 200,
    body: {
      signup: {
        id: rows[0].id,
        slotId: rows[0].slot_id,
        driverName: rows[0].driver_name,
      },
    },
  };
}

async function cancelSignup(teamId: string, body: Record<string, unknown>) {
  if (!sql) throw new HttpError(503, "Write service is unavailable");
  const signupId = requiredId(body.signupId, "Signup");
  const editTokenHash = await sha256(requiredEditToken(body.editToken));

  const rows = await sql`
    update private.signups signup
    set cancelled_at = now()
    from private.carpool_slots slot
    join private.team_events team_event on team_event.id = slot.team_event_id
    join private.team_seasons season on season.id = team_event.team_season_id
    where signup.id = ${signupId}
      and signup.carpool_slot_id = slot.id
      and season.team_id = ${teamId}
      and signup.edit_token_hash = ${editTokenHash}
      and signup.cancelled_at is null
    returning signup.id::text as id
  `;

  if (!rows[0]) {
    throw new HttpError(403, "This browser cannot cancel that signup");
  }

  return { status: 200, body: { cancelled: true, signupId: rows[0].id } };
}

async function createAddress(teamId: string, body: Record<string, unknown>) {
  if (!sql) throw new HttpError(503, "Write service is unavailable");
  const name = requiredText(body.childOrFamilyName, "Child or family name", 60);
  const addressText = requiredText(body.addressText, "Pickup address", 180);
  const editToken = generateEditToken();
  const editTokenHash = await sha256(editToken);

  const rows = await sql`
    insert into private.pickup_addresses (
      team_id,
      child_or_family_name,
      address_text,
      edit_token_hash
    )
    select id, ${name}, ${addressText}, ${editTokenHash}
    from private.teams
    where id = ${teamId}
      and active
    returning
      id::text as id,
      child_or_family_name,
      address_text
  `;

  if (!rows[0]) throw new HttpError(404, "Team not found");

  return {
    status: 201,
    body: {
      address: {
        id: rows[0].id,
        childOrFamilyName: rows[0].child_or_family_name,
        addressText: rows[0].address_text,
      },
      editToken,
    },
  };
}

async function updateAddress(teamId: string, body: Record<string, unknown>) {
  if (!sql) throw new HttpError(503, "Write service is unavailable");
  const addressId = requiredId(body.addressId, "Pickup address");
  const name = requiredText(body.childOrFamilyName, "Child or family name", 60);
  const addressText = requiredText(body.addressText, "Pickup address", 180);
  const editTokenHash = await sha256(requiredEditToken(body.editToken));

  const rows = await sql`
    update private.pickup_addresses address
    set
      child_or_family_name = ${name},
      address_text = ${addressText}
    where address.id = ${addressId}
      and address.team_id = ${teamId}
      and address.edit_token_hash = ${editTokenHash}
      and address.archived_at is null
    returning id::text as id, child_or_family_name, address_text
  `;

  if (!rows[0]) {
    throw new HttpError(403, "This browser cannot edit that address");
  }

  return {
    status: 200,
    body: {
      address: {
        id: rows[0].id,
        childOrFamilyName: rows[0].child_or_family_name,
        addressText: rows[0].address_text,
      },
    },
  };
}

async function archiveAddress(teamId: string, body: Record<string, unknown>) {
  if (!sql) throw new HttpError(503, "Write service is unavailable");
  const addressId = requiredId(body.addressId, "Pickup address");
  const editTokenHash = await sha256(requiredEditToken(body.editToken));

  const rows = await sql`
    update private.pickup_addresses
    set archived_at = now()
    where id = ${addressId}
      and team_id = ${teamId}
      and edit_token_hash = ${editTokenHash}
      and archived_at is null
    returning id::text as id
  `;

  if (!rows[0]) {
    throw new HttpError(403, "This browser cannot remove that address");
  }

  return { status: 200, body: { archived: true, addressId: rows[0].id } };
}

async function createComment(teamId: string, body: Record<string, unknown>) {
  if (!sql) throw new HttpError(503, "Write service is unavailable");
  const slotId = requiredId(body.slotId, "Carpool slot");
  const authorName = requiredText(body.authorName, "Your name", 60);
  const commentBody = requiredCommentBody(body.body);
  const editToken = generateEditToken();
  const editTokenHash = await sha256(editToken);

  const rows = await sql`
    insert into private.slot_comments (
      carpool_slot_id,
      author_name,
      body,
      edit_token_hash
    )
    select
      slot.id,
      ${authorName},
      ${commentBody},
      ${editTokenHash}
    from private.carpool_slots slot
    join private.team_events team_event on team_event.id = slot.team_event_id
    join private.team_seasons season on season.id = team_event.team_season_id
    join private.teams team on team.id = season.team_id
    join private.source_events source_event on source_event.id = team_event.source_event_id
    where slot.id = ${slotId}
      and season.team_id = ${teamId}
      and season.active
      and slot.active
      and team_event.visibility = 'listed'
      and source_event.status <> 'cancelled'
      and source_event.removed_at is null
      and (source_event.starts_at at time zone team.timezone)::date >=
        (now() at time zone team.timezone)::date
    returning
      id::text as id,
      carpool_slot_id::text as slot_id,
      author_name,
      body,
      created_at,
      updated_at
  `;

  if (!rows[0]) throw new HttpError(404, "That carpool segment is no longer available");

  return {
    status: 201,
    body: {
      comment: {
        id: rows[0].id,
        slotId: rows[0].slot_id,
        authorName: rows[0].author_name,
        body: rows[0].body,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at,
      },
      editToken,
    },
  };
}

async function updateComment(teamId: string, body: Record<string, unknown>) {
  if (!sql) throw new HttpError(503, "Write service is unavailable");
  const commentId = requiredId(body.commentId, "Comment");
  const commentBody = requiredCommentBody(body.body);
  const editTokenHash = await sha256(requiredEditToken(body.editToken));

  const rows = await sql`
    update private.slot_comments slot_comment
    set body = ${commentBody}
    from private.carpool_slots slot
    join private.team_events team_event on team_event.id = slot.team_event_id
    join private.team_seasons season on season.id = team_event.team_season_id
    where slot_comment.id = ${commentId}
      and slot_comment.carpool_slot_id = slot.id
      and season.team_id = ${teamId}
      and slot_comment.edit_token_hash = ${editTokenHash}
      and slot_comment.deleted_at is null
    returning
      slot_comment.id::text as id,
      slot_comment.carpool_slot_id::text as slot_id,
      slot_comment.author_name,
      slot_comment.body,
      slot_comment.created_at,
      slot_comment.updated_at
  `;

  if (!rows[0]) {
    throw new HttpError(403, "This browser cannot edit that comment");
  }

  return {
    status: 200,
    body: {
      comment: {
        id: rows[0].id,
        slotId: rows[0].slot_id,
        authorName: rows[0].author_name,
        body: rows[0].body,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at,
      },
    },
  };
}

async function deleteComment(teamId: string, body: Record<string, unknown>) {
  if (!sql) throw new HttpError(503, "Write service is unavailable");
  const commentId = requiredId(body.commentId, "Comment");
  const editTokenHash = await sha256(requiredEditToken(body.editToken));

  const rows = await sql`
    update private.slot_comments slot_comment
    set deleted_at = now()
    from private.carpool_slots slot
    join private.team_events team_event on team_event.id = slot.team_event_id
    join private.team_seasons season on season.id = team_event.team_season_id
    where slot_comment.id = ${commentId}
      and slot_comment.carpool_slot_id = slot.id
      and season.team_id = ${teamId}
      and slot_comment.edit_token_hash = ${editTokenHash}
      and slot_comment.deleted_at is null
    returning slot_comment.id::text as id, slot_comment.carpool_slot_id::text as slot_id
  `;

  if (!rows[0]) {
    throw new HttpError(403, "This browser cannot remove that comment");
  }

  return {
    status: 200,
    body: { deleted: true, commentId: rows[0].id, slotId: rows[0].slot_id },
  };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, origin);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders(origin) });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 8192) {
    return jsonResponse({ error: "Request body is too large" }, 413, origin);
  }

  try {
    const access = await authorizeTeam(request);
    const rawBody = await request.text();
    if (rawBody.length > 8192) {
      throw new HttpError(413, "Request body is too large");
    }
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const action = requiredText(body.action, "Action", 40);

    let result;
    switch (action) {
      case "signup.create":
        result = await createSignup(access.team_id, body);
        break;
      case "signup.update":
        result = await updateSignup(access.team_id, body);
        break;
      case "signup.cancel":
        result = await cancelSignup(access.team_id, body);
        break;
      case "address.create":
        result = await createAddress(access.team_id, body);
        break;
      case "address.update":
        result = await updateAddress(access.team_id, body);
        break;
      case "address.archive":
        result = await archiveAddress(access.team_id, body);
        break;
      case "comment.create":
        result = await createComment(access.team_id, body);
        break;
      case "comment.update":
        result = await updateComment(access.team_id, body);
        break;
      case "comment.delete":
        result = await deleteComment(access.team_id, body);
        break;
      default:
        throw new HttpError(400, "Action is not supported");
    }

    if (sql) {
      await sql`
        update private.access_tokens
        set last_used_at = now()
        where id = ${access.access_token_id}
      `;
    }

    return jsonResponse(result.body, result.status, origin);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status, origin);
    }

    if (error instanceof SyntaxError) {
      return jsonResponse({ error: "Request body must be valid JSON" }, 400, origin);
    }

    console.error("team-actions request failed", error);
    return jsonResponse({ error: "The change could not be saved" }, 500, origin);
  }
});
