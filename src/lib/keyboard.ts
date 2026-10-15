// A barcode scanner "types" the code like a keyboard. If the computer's keyboard is set to
// Thai, PF-FDP-01 arrives as ญโขโฏญขจๅ. This turns Thai (Kedmanee) key output back into the
// English keys that were pressed.
const US = "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./" + '~!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:"ZXCVBNM<>?'
const TH = '_ๅ/-ภถุึคตจขชๆไำพะัีรนยบลฃฟหกดเ้่าสวงผปแอิืทมใฝ' + '%+๑๒๓๔ู฿๕๖๗๘๙๐"ฎฑธํ๊ณฯญฐ,ฅฤฆฏโฌ็๋ษศซ.()ฉฮฺ์?ฒฬฦ'
const MAP = new Map([...TH].map((c, i) => [c, US[i]]))

export function fixThaiKeyboard(s: string) {
  if (!/[฀-๿]/.test(s)) return s
  return [...s].map((c) => MAP.get(c) ?? c).join('')
}

// Physical key → English character, so scanner input is read the same whatever language
// the keyboard is set to (Thai input on iPhone can also drop or reorder Thai marks).
const CODE: Record<string, [string, string]> = {
  Backquote: ['`', '~'], Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'],
  Backslash: ['\\', '|'], Semicolon: [';', ':'], Quote: ["'", '"'], Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'],
  Space: [' ', ' '],
}
'1234567890'.split('').forEach((d, i) => { CODE['Digit' + d] = [d, '!@#$%^&*()'[i]] })
'abcdefghijklmnopqrstuvwxyz'.split('').forEach((c) => { CODE['Key' + c.toUpperCase()] = [c, c.toUpperCase()] })

/** The English character for a key press, or null when the key is unknown (e.g. on-screen keyboards). */
export function englishKey(e: { code?: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }) {
  if (e.ctrlKey || e.metaKey || e.altKey || !e.code) return null
  const k = CODE[e.code]
  return k ? k[e.shiftKey ? 1 : 0] : null
}
