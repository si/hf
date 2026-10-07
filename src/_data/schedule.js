// Release schedule for the rest of the year, rendered as a Thu-Sun grid on /schedule/.
// Edit `episodes` below when slots change; the grid is generated from it at build time.
// `djs` is a list so a back-to-back set can name everyone.
const episodes = [
  { date: "2026-10-02", number: 343, djs: ["Disco77"] },
  { date: "2026-10-09", number: 344, djs: ["Taylan"] },
  { date: "2026-10-16", number: 345, djs: ["DJ Tai"] },
  { date: "2026-10-23", number: 346, djs: ["Andi King"] },
  { date: "2026-10-30", number: 347, djs: ["Sarah Jae"] },
  { date: "2026-11-06", number: 348, djs: ["DJ Tai"] },
  { date: "2026-11-13", number: 349, djs: ["Andi King"] },
  { date: "2026-11-20", number: 350, djs: ["LYP"] },
  { date: "2026-11-27", number: 351, djs: ["Sarah Jae"] },
  { date: "2026-12-04", number: 352, djs: ["DJ Tai"] },
  { date: "2026-12-11", number: 353, djs: ["LYP"] },
  { date: "2026-12-18", number: 354, djs: ["Andi King", "Disco77"] },
  { date: "2026-12-25", number: 355, djs: ["One Phat DJ"], note: "Christmas Special" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Thu", "Fri", "Sat", "Sun"];

// All date maths is done in UTC so the build machine's timezone can't shift a day.
const parse = (iso) => new Date(`${iso}T00:00:00Z`);
const toIso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

module.exports = () => {
  const byDate = new Map(episodes.map((e) => [e.date, e]));
  const months = new Map();

  for (const episode of episodes) {
    const friday = parse(episode.date);
    const key = episode.date.slice(0, 7);
    if (!months.has(key)) {
      months.set(key, {
        key,
        name: MONTHS[friday.getUTCMonth()],
        year: friday.getUTCFullYear(),
        weeks: [],
      });
    }
    const month = months.get(key);

    // One row per release weekend: Thursday before, Friday, Saturday, Sunday after.
    const cells = [-1, 0, 1, 2].map((offset, i) => {
      const day = addDays(friday, offset);
      const iso = toIso(day);
      const sameMonth = day.getUTCMonth() === friday.getUTCMonth();
      return {
        iso,
        weekday: WEEKDAYS[i],
        day: day.getUTCDate(),
        // Show the month when a weekend straddles two months (e.g. Thu 30 Oct, Sun 1 Nov).
        monthLabel: sameMonth ? null : MONTHS_SHORT[day.getUTCMonth()],
        isRelease: offset === 0,
        episode: offset === 0 ? byDate.get(iso) : null,
      };
    });

    month.weeks.push({ friday: episode.date, cells });
  }

  const list = episodes.map((e) => ({
    ...e,
    // Same format as the "House Finesse" Google Calendar titles.
    title: `HF${e.number} with ${e.djs.join(" & ")}${e.note ? ` - ${e.note}` : ""}`,
  }));
  const titleByDate = new Map(list.map((e) => [e.date, e]));

  const result = Array.from(months.values());
  for (const month of result) {
    for (const week of month.weeks) {
      for (const cell of week.cells) {
        if (cell.episode) cell.episode = titleByDate.get(cell.iso);
      }
    }
  }
  return { months: result, episodes: list };
};
