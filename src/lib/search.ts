/** Lowercase, Arabic spelling variants merged (أ إ آ → ا, ة → ه, ى → ي), tashkeel and tatweel dropped, spaces and dashes ignored. */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-_.']/g, '');

/** True when `query` is inside any of the labels (an option's Arabic and English names). An empty query matches everything. */
export const matches = (query: string, ...labels: string[]) => {
  const q = fold(query);
  return labels.some((l) => fold(l).includes(q));
};
