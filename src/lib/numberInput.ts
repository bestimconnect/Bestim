/** Typed numbers: Arabic-Indic digits become Latin, `٫` and `,` count as the decimal point, `٬` (thousands) is dropped, everything else but digits goes. */
export const clean = (s: string, dec = false) => {
  const v = s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[٫,]/g, dec ? '.' : '')
    .replace(dec ? /[^\d.]/g : /\D/g, '');
  return dec ? v.replace(/\./g, (m, i) => (v.indexOf('.') === i ? m : '')) : v; // only the first point stays
};
