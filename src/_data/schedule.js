// Release schedule for /calendar/, built from the public "House Finesse" Google Calendar.
// The calendar is the single source of truth: change an event title there and the next
// site build picks it up (titles follow "HF344 with Taylan", optionally "... - Christmas Special").
//
// If the feed can't be loaded or has no episodes, `available` is false (the build does not fail)
// and the calendar page falls back to the Google Calendar embed.
//
// Local/offline builds: set HF_CALENDAR_ICS=/path/to/file.ics to read a saved copy of the feed
// instead of fetching it.
const fs = require("node:fs");
const ical = require("node-ical");

const CALENDAR_ID =
  "bc515ecffc1a9eafaee5cbae9eede94f9cde7ad6fc858a46a94ddd45447fc360@group.calendar.google.com";
const FEED_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(
  CALENDAR_ID
)}/public/basic.ics`;
const TIMEZONE = "Europe/London";

// Links for following the calendar from the page (the same base64 id the Google embed uses).
const LINKS = {
  feedUrl: FEED_URL,
  webcalUrl: FEED_URL.replace(/^https:/, "webcal:"),
  addUrl: `https://calendar.google.com/calendar/r?cid=${Buffer.from(CALENDAR_ID)
    .toString("base64")
    .replace(/=+$/, "")}`,
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Thu", "Fri", "Sat", "Sun"];

// Dates are handled as plain YYYY-MM-DD strings in UTC so the build machine's timezone
// can never shift a day.
const parse = (iso) => new Date(`${iso}T00:00:00Z`);
const toIso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// The calendar day an instant falls on in the show's timezone.
const londonDate = (instant) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(instant);

async function loadFeed() {
  if (process.env.HF_CALENDAR_ICS) {
    return fs.readFileSync(process.env.HF_CALENDAR_ICS, "utf8");
  }
  const response = await fetch(FEED_URL, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    throw new Error(
      `Could not load the House Finesse calendar feed (HTTP ${response.status}). ` +
        `Check the calendar is still shared publicly, or set HF_CALENDAR_ICS to a local copy.`
    );
  }
  return response.text();
}

// "🎧 HF344 with Taylan", "HF354 with Andi King & Disco77", "HF355 with One Phat DJ - Christmas Special".
// A bare "HF344" (slot not assigned yet) is kept and shown as to be confirmed.
function parseTitle(summary) {
  const clean = String(summary || "")
    .replace(/^[^A-Za-z0-9]+/, "")
    .trim();
  const match = clean.match(/^HF\s?(\d+)\b\s*(?:with\s+(.+?))?\s*(?:-\s+(.+))?$/i);
  if (!match) return null;
  const [, number, djs, note] = match;
  return {
    number: Number(number),
    title: clean,
    djs: djs ? djs.split(/\s+(?:&|and)\s+/i) : [],
    note: note || null,
    tbc: !djs,
  };
}

async function buildSchedule() {
  const feed = ical.sync.parseICS(await loadFeed());

  // Window: the start of the current month to the end of the year ("the rest of the year").
  const today = parse(londonDate(new Date()));
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const to = new Date(Date.UTC(today.getUTCFullYear(), 11, 31, 23, 59, 59));

  const episodes = [];
  for (const event of Object.values(feed)) {
    if (event.type !== "VEVENT") continue;
    // Handles the weekly series plus the per-episode edits Google stores against it.
    const instances = ical.expandRecurringEvent(event, { from, to });
    for (const instance of instances) {
      const parsed = parseTitle(instance.summary);
      if (!parsed) continue;
      episodes.push({ date: londonDate(instance.start), ...parsed });
    }
  }
  episodes.sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);

  const byDate = new Map(episodes.map((e) => [e.date, e]));
  const fridays = new Set();
  for (const episode of episodes) {
    const day = parse(episode.date);
    // Anchor each row on the Friday of that Mon-Sun week (Sun counts as the end of the week).
    const dow = (day.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
    fridays.add(toIso(addDays(day, 4 - dow)));
  }

  const months = new Map();
  for (const fridayIso of [...fridays].sort()) {
    const friday = parse(fridayIso);
    const key = fridayIso.slice(0, 7);
    if (!months.has(key)) {
      months.set(key, {
        key,
        name: MONTHS[friday.getUTCMonth()],
        year: friday.getUTCFullYear(),
        weeks: [],
      });
    }

    // One row per release weekend: Thursday before, Friday, Saturday, Sunday after.
    const cells = [-1, 0, 1, 2].map((offset, i) => {
      const day = addDays(friday, offset);
      const iso = toIso(day);
      const episode = byDate.get(iso) || null;
      return {
        iso,
        weekday: WEEKDAYS[i],
        day: day.getUTCDate(),
        // Show the month when a weekend straddles two months (e.g. Thu 30 Oct, Sun 1 Nov).
        monthLabel:
          day.getUTCMonth() === friday.getUTCMonth() ? null : MONTHS_SHORT[day.getUTCMonth()],
        isRelease: offset === 0 || Boolean(episode),
        episode,
      };
    });
    months.get(key).weeks.push({ friday: fridayIso, cells });
  }

  if (episodes.length === 0) {
    throw new Error("The calendar feed loaded but has no HF episodes for the rest of the year.");
  }

  return { available: true, ...LINKS, months: [...months.values()], episodes };
}

module.exports = async () => {
  try {
    return await buildSchedule();
  } catch (error) {
    const reason = error.cause?.code ? `${error.message} (${error.cause.code})` : error.message;
    console.warn(`[schedule] Using the Google Calendar embed instead of the grid: ${reason}`);
    return { available: false, ...LINKS, months: [], episodes: [] };
  }
};
