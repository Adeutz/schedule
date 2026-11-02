// Picking a day on the schedule picture — apart from the page, so it can be
// checked on its own

// The day a tap at (x, y) landed on, both fractions of the picture's width and
// height. boxes: [[date, x0, y0, x1, y1], ...], where each day is on it. A tap
// on a margin, just outside every day, takes the nearest one within `reach`.
export function dayAt(boxes, x, y, reach = 0.04) {
  let best = null;
  let nearest = reach;
  for (const [date, x0, y0, x1, y1] of boxes) {
    const gap = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
    if (gap === 0) return date;
    if (gap < nearest) [best, nearest] = [date, gap];
  }
  return best;
}

// '2026-11-08': a Date's day on this phone's calendar
export const isoDate = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The day to show: the first of `wanted` the schedule has, else its first day
export function firstPick(days, ...wanted) {
  for (const date of wanted) {
    if (days.some(day => day.date === date)) return date;
  }
  return days.length ? days[0].date : null;
}
