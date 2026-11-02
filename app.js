// The schedule page: unlocked once with the passphrase, then always the
// latest schedule — looked for again each time the page is opened
import { words, fromBase64, toBase64, keyFor, open } from './crypto.js';

const KEY = 'schedule-key';     // {salt, key}: the passphrase's key, on this phone only
const $ = id => document.getElementById(id);
let box = null;                 // data.json as last fetched, still encrypted
let shown = null;               // ...and the one on screen (its iv)

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
  screen('view');
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

$('unlock').addEventListener('submit', async event => {
  event.preventDefault();
  const passphrase = $('passphrase').value;
  if (!words(passphrase) || !box) return;
  $('wrong').hidden = true;
  $('go').disabled = true;
  try {
    const key = await keyFor(passphrase, box.kdf);
    const data = await open(box, key);
    localStorage.setItem(KEY, JSON.stringify({ salt: box.kdf.salt, key: toBase64(key) }));
    $('passphrase').value = '';
    $('passphrase').blur();
    show(data);
  } catch {
    $('wrong').hidden = false;
  } finally {
    $('go').disabled = false;
  }
});

$('forget').addEventListener('click', () => {
  localStorage.removeItem(KEY);
  shown = null;
  screen('lock');
});
$('retry').addEventListener('click', refresh);
$('picture').addEventListener('click', () => $('frame').classList.toggle('zoomed'));
// Back on screen (opened from the home screen again): look for a newer one
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});

// Opened in Safari rather than from the home screen: say how to put it there
if (navigator.standalone === false) $('hint').hidden = false;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
refresh();
