// The schedule page: unlocked once with the code, then always the latest
// schedule — looked for again each time the page is opened
import { words, fromBase64, toBase64, keyFor, open } from './crypto.js';
import { dayAt, isoDate, firstPick } from './days.js';

const KEY = 'schedule-key';     // {salt, key}: the code's key, on this phone only
const TRY_AT = 6;               // digits typed: try the code without waiting for Open
const $ = id => document.getElementById(id);
let box = null;                 // data.json as last fetched, still encrypted
let shown = null;               // ...and the one on screen (its iv)
let trying = false;
let days = [];                  // each day in detail, and where it is on the picture
let boxes = [];
let picked = null;              // the day whose details are showing

function savedKey() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function screen(name) {
  for (const id of ['loading', 'lock', 'view', 'trouble']) $(id).hidden = id !== name;
}

async function fetchBox() {
  const response = await fetch(`data.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function ago(iso) {
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 864e5);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

function element(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

function show(data) {
  shown = box.iv;
  document.title = data.title;
  $('title').textContent = data.title;
  $('span').textContent = data.span;
  $('updated').textContent = `Updated ${data.updated_text} (${ago(data.updated)})`;
  $('note').hidden = !data.note;
  $('note-label').textContent = data.note_label || '';
  $('note-text').textContent = data.note || '';
  $('picture').src = `data:image/png;base64,${data.png}`;
  $('picture').alt = `Picture of ${data.title.toLowerCase()}, ${data.span}`;
  $('weeks').replaceChildren(...data.weeks.flatMap(([heading, items]) => {
    const list = document.createElement('ul');
    list.append(...items.map(item => element('li', item)));
    return [element('h2', heading), list];
  }));
  $('legend').textContent = data.legend;
  days = data.days || [];
  boxes = data.boxes || [];
  $('tip').hidden = !days.length;
  // A day named in the address, the one already showing, today, or the first
  pick(firstPick(days, decodeURIComponent(location.hash.slice(1)), picked, isoDate(new Date())));
  screen('view');
}

// One day's details under the picture, and that day outlined on it
function pick(date) {
  const i = days.findIndex(day => day.date === date);
  $('day').hidden = i < 0;
  $('mark').hidden = true;
  if (i < 0) return;
  picked = date;
  const day = days[i];
  $('day-title').textContent = day.title;
  $('day-sub').textContent = day.sub;
  $('day-note').hidden = !day.note;
  $('day-note').textContent = day.note || '';
  $('day-items').replaceChildren(...day.items.map(([time, what, more]) => {
    const item = document.createElement('li');
    const words = element('span', what);
    if (more) words.append(element('small', more));
    item.append(element('span', time), words);
    item.firstChild.className = 'at';
    return item;
  }));
  $('prev').disabled = i === 0;
  $('next').disabled = i === days.length - 1;
  const spot = boxes.find(b => b[0] === date);
  if (spot) {
    const [, x0, y0, x1, y1] = spot;
    Object.assign($('mark').style, { left: `${x0 * 100}%`, top: `${y0 * 100}%`,
                                     width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` });
    $('mark').hidden = false;
  }
}

function step(by) {
  const next = days[days.findIndex(day => day.date === picked) + by];
  if (next) pick(next.date);
}

async function refresh() {
  try {
    box = await fetchBox();
  } catch {
    if (!box) {
      screen('trouble');
      return;
    }
  }
  if (box.iv === shown) return;
  const saved = savedKey();
  if (saved && saved.salt === box.kdf.salt) {
    try {
      show(await open(box, fromBase64(saved.key)));
      return;
    } catch {
      localStorage.removeItem(KEY);
    }
  }
  screen('lock');
}

async function unlock(code) {
  if (trying || !box || !words(code)) return;
  trying = true;
  $('wrong').hidden = true;
  $('go').disabled = true;
  try {
    const key = await keyFor(code, box.kdf);
    const data = await open(box, key);
    // Kept for good: the code is never asked for again on this phone
    localStorage.setItem(KEY, JSON.stringify({ salt: box.kdf.salt, key: toBase64(key) }));
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    $('passphrase').blur();
    show(data);
  } catch {
    $('wrong').hidden = false;
  } finally {
    $('passphrase').value = '';
    $('go').disabled = false;
    trying = false;
  }
}

$('unlock').addEventListener('submit', event => {
  event.preventDefault();
  unlock($('passphrase').value);
});
// The number pad has no Go key: the 6th digit is enough
$('passphrase').addEventListener('input', () => {
  const code = $('passphrase').value;
  if (code.replace(/\D/g, '').length >= TRY_AT) unlock(code);
});
$('retry').addEventListener('click', refresh);
// Tapping a day on the picture shows its details
$('pic').addEventListener('click', event => {
  const rect = $('picture').getBoundingClientRect();
  const date = dayAt(boxes, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  if (!date) return;
  pick(date);
  $('day').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('zoom').addEventListener('click', () => {
  const zoomed = $('frame').classList.toggle('zoomed');
  $('zoom').textContent = zoomed ? 'Zoom out' : 'Zoom in';
  const spot = boxes.find(b => b[0] === picked);     // the picked day stays in view
  if (zoomed && spot) $('frame').scrollLeft = spot[1] * $('pic').offsetWidth - 16;
});
// Back on screen (opened from the home screen again): look for a newer one
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});

// Opened in Safari rather than from the home screen: say how to put it there
if (navigator.standalone === false) $('hint').hidden = false;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
refresh();
