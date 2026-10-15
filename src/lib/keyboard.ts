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
