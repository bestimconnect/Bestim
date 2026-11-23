type Palette = Record<
  | 'lime' | 'ink' | 'teal' | 'paper' | 'white' | 'muted' | 'line' | 'coral' | 'blush' | 'sky' | 'mint' | 'amber' | 'danger' | 'panel' | 'onpanel' | 'sheet'
  | 'ok' | 'soon' | 'late' | 'okTint' | 'soonTint' | 'lateTint' | 'tick' | 'nav' | 'btn' | 'onbtn' | 'violet'
  | 'gl' | 'onlime' | 'avatar' | 'cat2',
  string
>;
export const palette: { light: Palette; dark: Palette };
