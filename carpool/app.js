const STORAGE_KEY = "team-ride-board-signups-v1";
const OWNER_KEY = "team-ride-board-owner-v1";
const ADDRESS_STORAGE_KEY = "team-ride-board-addresses-v1";
const COMMENT_STORAGE_KEY = "team-ride-board-comments-v1";
const COMMENTER_NAME_KEY = "team-ride-board-commenter-name-v1";
const SCHEDULE_API_URL = "https://fmrgosorbzkhcssondak.supabase.co/functions/v1/team-schedule";
const ACTIONS_API_URL = "https://fmrgosorbzkhcssondak.supabase.co/functions/v1/team-actions";
let teamTimezone = "America/New_York";
let teamAccessToken = null;
let calendarFeedUrl = null;
let activeTeamSlug = null;
let activeTeamName = "Team";

let calendarEvents = [];
let schedule = [];
let trips = [];
const ownerId = getOwnerId();
let signups = {};
let activeTripId = null;
let addresses = [];
let activeAddressId = null;
let commentOwnership = {};
let activeCommentTripId = null;
let editingCommentId = null;

const scheduleList = document.querySelector("#schedule-list");
const signupDialog = document.querySelector("#signup-dialog");
const signupForm = document.querySelector("#signup-form");
const driverName = document.querySelector("#driver-name");
const tripRecap = document.querySelector("#trip-recap");
const dialogEyebrow = document.querySelector("#dialog-eyebrow");
const signupTitle = document.querySelector("#signup-title");
const saveSignup = document.querySelector("#save-signup");
const cancelSignup = document.querySelector("#cancel-signup");
const calendarDialog = document.querySelector("#calendar-dialog");
const commentDialog = document.querySelector("#comment-dialog");
const commentForm = document.querySelector("#comment-form");
const commentThread = document.querySelector("#comment-thread");
const commentTripRecap = document.querySelector("#comment-trip-recap");
const commenterName = document.querySelector("#commenter-name");
const commentBody = document.querySelector("#comment-body");
const saveComment = document.querySelector("#save-comment");
const cancelCommentEdit = document.querySelector("#cancel-comment-edit");
const toast = document.querySelector("#toast");
const scheduleCount = document.querySelector("#schedule-count");
const scheduleToday = document.querySelector("#schedule-today");
const addressBook = document.querySelector("#address-book");
const addressForm = document.querySelector("#address-form");
const addressFormEyebrow = document.querySelector("#address-form-eyebrow");
const addressFormTitle = document.querySelector("#address-form-title");
const addressCount = document.querySelector("#address-count");
const addressList = document.querySelector("#address-list");
const childName = document.querySelector("#child-name");
const pickupAddress = document.querySelector("#pickup-address");
const saveAddress = document.querySelector("#save-address");
const cancelAddressEdit = document.querySelector("#cancel-address-edit");
const teamLogo = document.querySelector("#team-logo");
const teamMark = document.querySelector(".team-mark");
const teamMarkName = document.querySelector("#team-mark-name");
const teamSeason = document.querySelector("#team-season");

const initialToday = getDateKeyInNewYork();
renderAddresses();
renderLoading();
loadTeamSchedule();

document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  document.querySelector("#schedule").scrollIntoView({ block: "start" });
});

document.querySelector(".team-mark").addEventListener("click", (event) => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelectorAll("[data-calendar-open]").forEach((button) => {
  button.addEventListener("click", () => calendarDialog.showModal());
});

document.querySelectorAll("[data-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => {
    button.closest("dialog")?.close("cancel");
  });
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close("cancel");
  });
});

document.querySelector("#copy-feed").addEventListener("click", async () => {
  if (!calendarFeedUrl) {
    showToast("The calendar address is not available yet.");
    return;
  }
  try {
    await navigator.clipboard.writeText(calendarFeedUrl);
    showToast("Calendar address copied.");
  } catch {
    showToast("Select and copy the calendar address above.");
  }
});

document.querySelector("#download-calendar").addEventListener("click", () => {
  if (!calendarFeedUrl) {
    showToast("The calendar address is not available yet.");
    return;
  }
  window.open(calendarFeedUrl, "_blank", "noopener,noreferrer");
});

commentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const trip = trips.find((item) => item.id === activeCommentTripId);
  const authorName = commenterName.value.trim();
  const body = commentBody.value.trim();
  const editing = Boolean(editingCommentId);
  if (!trip || !authorName || !body) return;

  const existing = editing
    ? getOwnedComment(editingCommentId)
    : null;
  if (editing && !existing) {
    showToast("This browser cannot edit that comment.");
    return;
  }

  saveComment.disabled = true;
  saveComment.textContent = "Saving…";

  try {
    const result = await runTeamAction(editing ? {
      action: "comment.update",
      commentId: editingCommentId,
      editToken: existing.editToken,
      body
    } : {
      action: "comment.create",
      slotId: trip.id,
      authorName,
      body
    });

    if (!editing) {
      commentOwnership[result.comment.id] = {
        editToken: result.editToken,
        ownerId
      };
      localStorage.setItem(getTeamStorageKey(COMMENTER_NAME_KEY), result.comment.authorName);
    }
    saveCommentOwnership();
    await loadTeamSchedule();
    resetCommentComposer();
    renderCommentThread();
    showToast(editing ? "Comment updated." : "Comment added to this carpool segment.");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "The comment could not be saved.");
  } finally {
    saveComment.disabled = false;
    saveComment.textContent = editingCommentId ? "Save changes" : "Post comment";
  }
});

cancelCommentEdit.addEventListener("click", resetCommentComposer);

addressForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = childName.value.trim();
  const address = pickupAddress.value.trim();
  if (!name || !address) return;
  const editing = Boolean(activeAddressId);
  const existing = editing
    ? addresses.find((entry) => entry.id === activeAddressId && entry.editToken)
    : null;

  if (editing && !existing) {
    showToast("This browser cannot edit that address.");
    return;
  }

  saveAddress.disabled = true;
  saveAddress.textContent = "Saving…";

  try {
    const result = await runTeamAction(editing ? {
      action: "address.update",
      addressId: existing.id,
      editToken: existing.editToken,
      childOrFamilyName: name,
      addressText: address
    } : {
      action: "address.create",
      childOrFamilyName: name,
      addressText: address
    });

    const saved = {
      id: result.address.id,
      childName: result.address.childOrFamilyName,
      address: result.address.addressText,
      editToken: editing ? existing.editToken : result.editToken,
      ownerId
    };

    addresses = editing
      ? addresses.map((entry) => entry.id === saved.id ? saved : entry)
      : [...addresses, saved].sort((a, b) => a.childName.localeCompare(b.childName));
    saveAddresses();
    resetAddressForm();
    renderAddresses();
    showToast(editing ? "Pickup address updated for the team." : "Pickup address shared with the team.");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "The address could not be saved.");
  } finally {
    saveAddress.disabled = false;
    saveAddress.textContent = activeAddressId ? "Save changes" : "Save address";
  }
});

cancelAddressEdit.addEventListener("click", resetAddressForm);

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = driverName.value.trim();
  if (!name || !activeTripId) return;
  const trip = trips.find((item) => item.id === activeTripId);
  const state = getTripState(trip);
  const editing = Boolean(state.driver && state.mine);

  saveSignup.disabled = true;
  saveSignup.textContent = "Saving…";

  try {
    const result = await runTeamAction(editing ? {
      action: "signup.update",
      signupId: state.signupId,
      editToken: state.editToken,
      driverName: name
    } : {
      action: "signup.create",
      slotId: activeTripId,
      driverName: name
    });

    signups[activeTripId] = {
      name: result.signup.driverName,
      signupId: result.signup.id,
      editToken: editing ? state.editToken : result.editToken,
      ownerId
    };
    saveSignups();
    await loadTeamSchedule();
    signupDialog.close();
    showToast(editing ? "Your driver name was updated." : "You’re signed up to drive.");
  } catch (error) {
    if (error?.status === 409) {
      await loadTeamSchedule();
      signupDialog.close();
    }
    showToast(error instanceof Error ? error.message : "The signup could not be saved.");
  } finally {
    saveSignup.disabled = false;
    saveSignup.textContent = editing ? "Save changes" : "Sign up to drive";
  }
});

cancelSignup.addEventListener("click", async () => {
  if (!activeTripId) return;
  const trip = trips.find((item) => item.id === activeTripId);
  const state = getTripState(trip);
  if (!state.mine) return;

  cancelSignup.disabled = true;
  cancelSignup.textContent = "Canceling…";

  try {
    await runTeamAction({
      action: "signup.cancel",
      signupId: state.signupId,
      editToken: state.editToken
    });
    delete signups[activeTripId];
    saveSignups();
    await loadTeamSchedule();
    signupDialog.close();
    showToast("Signup canceled. The ride is open again.");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "The signup could not be canceled.");
  } finally {
    cancelSignup.disabled = false;
    cancelSignup.textContent = "Cancel my signup";
  }
});

async function loadTeamSchedule() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get("access");

  if (!token) {
    renderAccessError(
      "Private team link required",
      "Open the full link shared by your team organizer."
    );
    return;
  }

  teamAccessToken = token;

  try {
    const response = await fetch(SCHEDULE_API_URL, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "This team link could not be opened.");
    }

    teamTimezone = payload.team.timezone || teamTimezone;
    activeTeamSlug = payload.team.slug;
    activeTeamName = payload.team.displayName;
    signups = loadSignups();
    addresses = loadAddresses();
    commentOwnership = loadCommentOwnership();
    applyTeamBrand(payload.team);
    calendarFeedUrl = typeof payload.calendarFeedUrl === "string" ? payload.calendarFeedUrl : null;
    const feedUrl = document.querySelector("#feed-url");
    const copyFeed = document.querySelector("#copy-feed");
    const downloadFeed = document.querySelector("#download-calendar");
    feedUrl.textContent = calendarFeedUrl || "Calendar feed unavailable";
    copyFeed.disabled = !calendarFeedUrl;
    downloadFeed.disabled = !calendarFeedUrl;
    calendarEvents = Array.isArray(payload.events) ? payload.events : [];
    schedule = buildSchedule(calendarEvents);
    trips = schedule.flatMap((event) => event.trips.map((trip) => ({
      ...trip,
      date: event.date,
      dateLabel: `${event.label}, ${event.month} ${event.day}`,
      eventTitle: event.title,
      eventTime: event.time,
      location: event.location
    })));

    const activeCommentIds = new Set(
      trips.flatMap((trip) => trip.comments.map((comment) => comment.id))
    );
    Object.keys(commentOwnership).forEach((commentId) => {
      if (!activeCommentIds.has(commentId)) delete commentOwnership[commentId];
    });
    saveCommentOwnership();

    const activeSignupIds = new Map(trips.map((trip) => [trip.id, trip.signupId]));
    Object.keys(signups).forEach((slotId) => {
      if (!signups[slotId]?.signupId || activeSignupIds.get(slotId) !== signups[slotId].signupId) {
        delete signups[slotId];
      }
    });
    saveSignups();

    const localAddresses = loadAddresses();
    addresses = (Array.isArray(payload.addresses) ? payload.addresses : []).map((entry) => {
      const local = localAddresses.find((item) => item.id === entry.id && item.editToken);
      return {
        id: entry.id,
        childName: entry.childOrFamilyName,
        address: entry.addressText,
        editToken: local?.editToken || null,
        ownerId: local?.editToken ? ownerId : null
      };
    });
    saveAddresses();
    renderAddresses();

    document.body.classList.remove("access-loading", "access-denied");
    document.title = `${payload.team.displayName} Carpool Board`;
    teamSeason.textContent = payload.season.label;
    teamMark.setAttribute("aria-label", `${payload.team.displayName} Carpool Board home`);

    const today = getDateKeyInNewYork();
    render(today);
    scrollToCurrentSchedule(today);
  } catch (error) {
    renderAccessError(
      "Team schedule unavailable",
      error instanceof Error ? error.message : "Please ask the organizer for a fresh link."
    );
  }
}

function applyTeamBrand(team) {
  const theme = team.theme && typeof team.theme === "object" ? team.theme : {};
  const properties = {
    "--navy": theme.primary,
    "--navy-deep": theme.primaryDeep,
    "--pool": theme.accent,
    "--pool-soft": theme.accentSoft,
    "--yellow": theme.highlight,
    "--yellow-soft": theme.highlightSoft,
    "--coral": theme.calendarAccent
  };

  Object.entries(properties).forEach(([property, value]) => {
    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
      document.documentElement.style.setProperty(property, value);
    }
  });

  const defaultLogos = {
    "blue-pumas": "./assets/blue-puma-logo.png",
    "red-tigers": "./assets/red-tiger-logo.png"
  };
  teamLogo.src = typeof theme.logoPath === "string"
    ? theme.logoPath
    : (defaultLogos[team.slug] || defaultLogos["blue-pumas"]);
  teamMarkName.textContent = team.displayName;
  document.body.dataset.team = team.slug;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta && typeof theme.primaryDeep === "string") {
    themeMeta.content = theme.primaryDeep;
  }
}

class ActionError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function runTeamAction(body) {
  if (!teamAccessToken) {
    throw new ActionError("Open the private team link before making a change.", 401);
  }

  const response = await fetch(ACTIONS_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${teamAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ActionError(payload.error || "The change could not be saved.", response.status);
  }
  return payload;
}

function buildSchedule(events) {
  return events.map((event) => {
    const date = getDateKeyInNewYork(new Date(event.start));
    const dateValue = new Date(`${date}T12:00:00`);
    const label = dateValue.toLocaleDateString("en-US", { weekday: "long" });
    const month = dateValue.toLocaleDateString("en-US", { month: "short" });
    const day = String(dateValue.getDate());

    return {
      ...event,
      date,
      label,
      month,
      day,
      type: event.type || (event.title.startsWith("Practice:") ? "Practice" : "Game"),
      time: `${formatEventTime(event.start)}–${formatEventTime(event.end)}`,
      trips: (event.slots || []).map((slot) => ({
        id: slot.id,
        route: slot.label,
        signupId: slot.signupId || null,
        driver: slot.driver || null,
        comments: Array.isArray(slot.comments) ? slot.comments : []
      }))
    };
  });
}

function renderLoading() {
  document.body.classList.add("access-loading");
  scheduleToday.textContent = "Checking link…";
  scheduleCount.textContent = "Loading the private team schedule.";
  scheduleList.innerHTML = `
    <div class="schedule-message" role="status">
      <span class="schedule-message__spinner" aria-hidden="true"></span>
      <strong>Opening the team board</strong>
      <span>Checking the link and loading the latest schedule.</span>
    </div>`;
}

function renderAccessError(title, message) {
  document.body.classList.remove("access-loading");
  document.body.classList.add("access-denied");
  scheduleToday.textContent = "Private";
  scheduleCount.textContent = "This schedule is available only through the team’s private link.";
  scheduleList.innerHTML = `
    <div class="schedule-message schedule-message--locked" role="alert">
      <span class="schedule-message__lock" aria-hidden="true">↗</span>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>`;
}

function getOwnerId() {
  let value = localStorage.getItem(OWNER_KEY);
  if (!value) {
    value = self.crypto?.randomUUID?.() || `owner-${Date.now()}`;
    localStorage.setItem(OWNER_KEY, value);
  }
  return value;
}

function loadSignups() {
  try {
    return JSON.parse(localStorage.getItem(getTeamStorageKey(STORAGE_KEY))) || {};
  } catch {
    return {};
  }
}

function saveSignups() {
  localStorage.setItem(getTeamStorageKey(STORAGE_KEY), JSON.stringify(signups));
}

function loadAddresses() {
  try {
    const saved = JSON.parse(localStorage.getItem(getTeamStorageKey(ADDRESS_STORAGE_KEY)));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveAddresses() {
  localStorage.setItem(getTeamStorageKey(ADDRESS_STORAGE_KEY), JSON.stringify(addresses));
}

function loadCommentOwnership() {
  try {
    return JSON.parse(localStorage.getItem(getTeamStorageKey(COMMENT_STORAGE_KEY))) || {};
  } catch {
    return {};
  }
}

function saveCommentOwnership() {
  localStorage.setItem(getTeamStorageKey(COMMENT_STORAGE_KEY), JSON.stringify(commentOwnership));
}

function getTeamStorageKey(baseKey) {
  return activeTeamSlug ? `${baseKey}:${activeTeamSlug}` : baseKey;
}

function getOwnedComment(commentId) {
  const local = commentOwnership[commentId];
  return local?.editToken && local.ownerId === ownerId ? local : null;
}

function renderAddresses() {
  addressCount.textContent = `${addresses.length} ${addresses.length === 1 ? "address" : "addresses"}`;
  addressList.innerHTML = addresses.length ? addresses.map((entry) => {
    const mine = entry.ownerId === ownerId;
    const actions = mine ? `
      <div class="address-entry__actions">
        <button type="button" data-address-edit="${entry.id}">Edit</button>
        <button class="address-remove" type="button" data-address-remove="${entry.id}">Remove</button>
      </div>` : "";

    return `
      <article class="address-entry">
        <span class="address-entry__pin" aria-hidden="true"></span>
        <div class="address-entry__copy">
          <strong>${escapeHtml(entry.childName)}</strong>
          <address>${escapeHtml(entry.address)}</address>
        </div>
        ${actions}
      </article>`;
  }).join("") : `<div class="address-empty">No pickup addresses saved yet.<br>Add the first one using the form.</div>`;

  addressList.querySelectorAll("[data-address-edit]").forEach((button) => {
    button.addEventListener("click", () => editAddress(button.dataset.addressEdit));
  });
  addressList.querySelectorAll("[data-address-remove]").forEach((button) => {
    button.addEventListener("click", () => removeAddress(button.dataset.addressRemove));
  });
}

function editAddress(addressId) {
  const entry = addresses.find((item) => item.id === addressId && item.ownerId === ownerId);
  if (!entry) return;

  activeAddressId = addressId;
  addressFormEyebrow.textContent = "Edit pickup";
  addressFormTitle.textContent = "Update this address";
  saveAddress.textContent = "Save changes";
  cancelAddressEdit.hidden = false;
  childName.value = entry.childName;
  pickupAddress.value = entry.address;
  addressBook.open = true;
  childName.focus();
}

async function removeAddress(addressId) {
  const entry = addresses.find((item) => item.id === addressId && item.ownerId === ownerId);
  if (!entry || !confirm(`Remove the pickup address for ${entry.childName}?`)) return;

  try {
    await runTeamAction({
      action: "address.archive",
      addressId: entry.id,
      editToken: entry.editToken
    });
    addresses = addresses.filter((item) => item.id !== addressId);
    saveAddresses();
    if (activeAddressId === addressId) resetAddressForm();
    renderAddresses();
    showToast("Pickup address removed for the team.");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "The address could not be removed.");
  }
}

function resetAddressForm() {
  activeAddressId = null;
  addressForm.reset();
  addressFormEyebrow.textContent = "Add a pickup";
  addressFormTitle.textContent = "Save an address";
  saveAddress.textContent = "Save address";
  cancelAddressEdit.hidden = true;
}

function getTripState(trip) {
  const local = signups[trip.id];
  const mine = Boolean(
    local?.editToken &&
    local?.signupId &&
    local.signupId === trip.signupId &&
    local.ownerId === ownerId
  );
  return {
    driver: trip.driver,
    mine,
    signupId: trip.signupId || null,
    editToken: mine ? local.editToken : null
  };
}

function render(todayDate = getDateKeyInNewYork()) {
  const visibleSchedule = getVisibleSchedule(todayDate);
  scheduleToday.textContent = `Today · ${formatShortDate(todayDate)}`;
  scheduleCount.textContent = visibleSchedule.length
    ? `${visibleSchedule.length} upcoming ${visibleSchedule.length === 1 ? "practice" : "practices"} from the LMFC calendar.`
    : `No upcoming ${activeTeamName} practices are currently scheduled.`;

  scheduleList.innerHTML = visibleSchedule.length ? visibleSchedule.map((event) => {
    const isToday = event.date === todayDate;
    const row = `
      <section class="schedule-row${isToday ? " schedule-row--today" : ""}" aria-label="${isToday ? "Today, " : ""}${event.label}, ${event.month} ${event.day}: ${escapeHtml(event.title)}">
        <div class="date-cell">
          <div class="date-cell__date">
            <span class="date-cell__number">${event.day}</span>
            <span class="date-cell__copy"><strong>${isToday ? "Today" : event.label}</strong><span>${event.month}</span></span>
          </div>
          <div class="event-meta">
            <span class="event-type event-type--${event.type.toLowerCase()}">${event.type}</span>
            <strong>${escapeHtml(event.title)}</strong>
            <span>${event.time} · ${escapeHtml(event.location)}</span>
          </div>
        </div>
        ${event.trips.map(renderSlot).join("")}
      </section>`;
    return row;
  }).join("") : `<div class="schedule-empty"><strong>Season complete</strong><span>New ${escapeHtml(activeTeamName)} practices will appear here when they are added to the LMFC calendar.</span></div>`;

  scheduleList.querySelectorAll("[data-signup]").forEach((button) => {
    button.addEventListener("click", () => openSignup(button.dataset.signup));
  });
  scheduleList.querySelectorAll("[data-comments]").forEach((button) => {
    button.addEventListener("click", () => openComments(button.dataset.comments));
  });
}

function getVisibleSchedule(todayDate = getDateKeyInNewYork()) {
  return schedule.filter((event) => event.date >= todayDate);
}

function getDateKeyInNewYork(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: teamTimezone
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatShortDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function scrollToCurrentSchedule(todayDate) {
  if (!schedule.some((event) => event.date < todayDate)) return;
  requestAnimationFrame(() => document.querySelector("#schedule").scrollIntoView({ block: "start" }));
}

function renderSlot(trip) {
  const state = getTripState(trip);
  const commentCount = trip.comments.length;
  const latestComment = trip.comments.at(-1);
  const driver = state.driver
    ? `<div class="slot__driver"><span class="slot__check" aria-hidden="true">✓</span><span><strong>${escapeHtml(state.driver)}</strong><small>${state.mine ? "Your signup" : "Driving"}</small></span></div>`
    : `<span class="slot__driver"><strong>Driver needed</strong></span>`;
  const commentPreview = latestComment ? `
    <button class="comment-preview" type="button" data-comments="${trip.id}" aria-label="Latest comment from ${escapeHtml(latestComment.authorName)}. Open the full thread.">
      <span class="comment-preview__author">${escapeHtml(latestComment.authorName)}</span>
      <span class="comment-preview__body">${escapeHtml(latestComment.body)}</span>
    </button>` : "";
  const action = state.driver
    ? (state.mine ? `<button class="edit-button" type="button" data-signup="${trip.id}" aria-label="Edit your signup for ${trip.route}">Edit</button>` : "")
    : `<button class="signup-button" type="button" data-signup="${trip.id}">I can drive</button>`;

  return `
    <div class="slot ${state.driver ? "" : "slot--open"}">
      <div class="slot__details">
        <span class="slot__route-mobile">${escapeHtml(trip.route)}</span>
        ${driver}
        ${commentPreview}
        <button class="comment-button${commentCount ? " comment-button--active" : ""}" type="button" data-comments="${trip.id}" aria-label="${commentCount ? `Open ${commentCount} ${commentCount === 1 ? "comment" : "comments"}` : "Add a comment"} for ${escapeHtml(trip.route)}">
          <span class="comment-button__icon" aria-hidden="true"></span>
          <span>${commentCount ? `${commentCount} ${commentCount === 1 ? "comment" : "comments"}` : "Comment"}</span>
        </button>
      </div>
      ${action}
  </div>`;
}

function openComments(tripId) {
  activeCommentTripId = tripId;
  const trip = trips.find((item) => item.id === tripId);
  if (!trip) return;

  commentTripRecap.innerHTML = `<strong>${trip.dateLabel} · ${trip.eventTime}</strong>${escapeHtml(trip.eventTitle)}<br>${escapeHtml(trip.location)} · ${escapeHtml(trip.route)}`;
  resetCommentComposer();
  renderCommentThread();
  commentDialog.showModal();
}

function renderCommentThread() {
  const trip = trips.find((item) => item.id === activeCommentTripId);
  if (!trip) return;

  commentThread.innerHTML = trip.comments.length ? trip.comments.map((comment) => {
    const mine = Boolean(getOwnedComment(comment.id));
    const edited = new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000;
    const actions = mine ? `
      <div class="thread-comment__actions">
        <button type="button" data-comment-edit="${comment.id}">Edit</button>
        <button class="thread-comment__remove" type="button" data-comment-remove="${comment.id}">Remove</button>
      </div>` : "";

    return `
      <article class="thread-comment">
        <header>
          <strong>${escapeHtml(comment.authorName)}</strong>
          <time datetime="${escapeHtml(comment.createdAt)}">${escapeHtml(formatCommentTime(comment.createdAt))}${edited ? " · Edited" : ""}</time>
        </header>
        <p>${escapeHtml(comment.body).replace(/\n/g, "<br>")}</p>
        ${actions}
      </article>`;
  }).join("") : `
    <div class="comment-thread__empty">
      <span class="comment-thread__empty-icon" aria-hidden="true"></span>
      <strong>No comments yet</strong>
      <span>Add a note if your child may miss this segment or the group should know something.</span>
    </div>`;

  commentThread.querySelectorAll("[data-comment-edit]").forEach((button) => {
    button.addEventListener("click", () => editComment(button.dataset.commentEdit));
  });
  commentThread.querySelectorAll("[data-comment-remove]").forEach((button) => {
    button.addEventListener("click", () => removeComment(button.dataset.commentRemove, button));
  });
}

function editComment(commentId) {
  const trip = trips.find((item) => item.id === activeCommentTripId);
  const comment = trip?.comments.find((item) => item.id === commentId);
  if (!comment || !getOwnedComment(commentId)) {
    showToast("This browser cannot edit that comment.");
    return;
  }

  editingCommentId = commentId;
  commenterName.value = comment.authorName;
  commenterName.disabled = true;
  commentBody.value = comment.body;
  saveComment.textContent = "Save changes";
  cancelCommentEdit.hidden = false;
  commentBody.focus();
}

async function removeComment(commentId, button) {
  const owned = getOwnedComment(commentId);
  if (!owned) {
    showToast("This browser cannot remove that comment.");
    return;
  }
  if (!window.confirm("Remove this comment from the thread?")) return;

  button.disabled = true;
  try {
    await runTeamAction({
      action: "comment.delete",
      commentId,
      editToken: owned.editToken
    });
    delete commentOwnership[commentId];
    saveCommentOwnership();
    await loadTeamSchedule();
    resetCommentComposer();
    renderCommentThread();
    showToast("Comment removed.");
  } catch (error) {
    button.disabled = false;
    showToast(error instanceof Error ? error.message : "The comment could not be removed.");
  }
}

function resetCommentComposer() {
  editingCommentId = null;
  commentForm.reset();
  commenterName.disabled = false;
  commenterName.value = localStorage.getItem(getTeamStorageKey(COMMENTER_NAME_KEY)) || "";
  saveComment.textContent = "Post comment";
  cancelCommentEdit.hidden = true;
}

function formatCommentTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: teamTimezone
  }).format(new Date(value));
}

function openSignup(tripId) {
  activeTripId = tripId;
  const trip = trips.find((item) => item.id === tripId);
  const state = getTripState(trip);
  const editing = Boolean(state.driver && state.mine);

  dialogEyebrow.textContent = editing ? "Your signup" : "Volunteer to drive";
  signupTitle.textContent = editing ? "Change your name" : "Add your name";
  saveSignup.textContent = editing ? "Save changes" : "Sign up to drive";
  cancelSignup.hidden = !editing;
  driverName.value = editing ? state.driver : "";
  tripRecap.innerHTML = `<strong>${trip.dateLabel} · ${trip.eventTime}</strong>${escapeHtml(trip.eventTitle)}<br>${escapeHtml(trip.location)} · ${escapeHtml(trip.route)}`;
  signupDialog.showModal();
  setTimeout(() => driverName.focus(), 50);
}

function formatEventTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: teamTimezone
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
  })[character]);
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("toast--visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("toast--visible"), 2400);
}
