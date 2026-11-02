// Opening the schedule: schedule_page.py's steps in reverse. data.json is
// AES-256-GCM encrypted; the key is PBKDF2-SHA256 of the passphrase's
// letters and numbers (lower case, one space between each run of them),
// with the salt and rounds data.json gives.

export function words(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).join(' ');
}

export function fromBase64(text) {
  return Uint8Array.from(atob(text), c => c.charCodeAt(0));
}

export function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

// The passphrase's key (32 bytes): kept on the phone, so it's typed once
export async function keyFor(passphrase, kdf) {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(words(passphrase)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(kdf.salt), iterations: kdf.iterations },
    base, 256);
  return new Uint8Array(bits);
}

// What data.json holds, opened with that key; throws when the key is wrong
export async function open(box, key) {
  const aes = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(box.iv) }, aes, fromBase64(box.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}
