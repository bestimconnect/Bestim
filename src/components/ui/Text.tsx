import { Text as RNText, type TextProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { palette } from '@/lib/palette';

type Weight = 300 | 400 | 500 | 700;

/**
 * The Figma text styles (design-system-plugin TYPE / TYPE_AR). `ar` = the Arabic line-height class (full literals so Tailwind sees them).
 * v2 names: num-xl/l/m, title-l, title-m, heading, body, body-sm, caption, tag. The old names map onto the v2 scale.
 */
const variants = {
  'num-xl': { size: 'text-num-xl', w: 300, latin: true },
  'num-l': { size: 'text-num-l', w: 300, latin: true },
  'num-m': { size: 'text-num-m', w: 300, latin: true },
  'title-l': { size: 'text-title-l', w: 500, ar: 'text-title-l-ar' },
  'title-m': { size: 'text-title-m', w: 500, ar: 'text-title-m-ar' },
  heading: { size: 'text-heading', w: 500, ar: 'text-heading-ar' },
  body: { size: 'text-body', w: 400, ar: 'text-body-ar' },
  'body-sm': { size: 'text-body-sm', w: 400, ar: 'text-body-sm-ar' },
  caption: { size: 'text-caption', w: 400, ar: 'text-caption-ar' },
  tag: { size: 'text-tag', w: 500, ar: 'text-tag-ar' },
  // legacy
  display: { size: 'text-display', w: 500, ar: 'text-display-ar' },
  title: { size: 'text-title', w: 500, ar: 'text-title-ar' },
  label: { size: 'text-label', w: 500, ar: 'text-label-ar' },
  number: { size: 'text-number', w: 300, latin: true },
  'small-number': { size: 'text-small-number', w: 300, latin: true },
} as const satisfies Record<string, { size: string; w: Weight; latin?: boolean; ar?: string }>;

export type TextVariant = keyof typeof variants;
type Props = TextProps & { variant?: TextVariant; className?: string };

const FAMILY = {
  Poppins: { 300: 'Poppins_300Light', 400: 'Poppins_400Regular', 500: 'Poppins_500Medium', 700: 'Poppins_700Bold' },
  Tajawal: { 300: 'Tajawal_400Regular', 400: 'Tajawal_400Regular', 500: 'Tajawal_500Medium', 700: 'Tajawal_700Bold' },
} as const;
// A custom font file carries its own weight, so `font-*` classes pick the file (RN ignores fontWeight for a named face).
const WEIGHT: Record<string, Weight> = { light: 300, normal: 400, medium: 500, semibold: 500, bold: 700, extrabold: 700 };
const weightClass = /(?:^|\s)!?font-(light|normal|medium|semibold|bold|extrabold)(?=\s|$)/;
// NativeWind resolves conflicting classes by stylesheet order, not className order, so only default to ink when no color is given.
const colorClass = new RegExp(`(^|\\s)!?text-(${Object.keys(palette.light).join('|')})(?=[\\s/]|$)|(^|\\s)!?text-\\[#`);

/** Tajawal for Arabic, Poppins for English and numbers. Defaults to ink; override colour, weight or size via className. */
export function Text({ variant = 'body', className = '', style, ...rest }: Props) {
  const { i18n } = useTranslation();
  const v = variants[variant];
  const latin = 'latin' in v || i18n.language === 'en';
  const w = WEIGHT[className.match(weightClass)?.[1] ?? ''] ?? v.w;
  const size = !latin && 'ar' in v ? v.ar : v.size;
  const color = colorClass.test(className) ? '' : 'text-ink';
  return <RNText className={`${size} ${color} text-left ${className}`} style={[{ fontFamily: FAMILY[latin ? 'Poppins' : 'Tajawal'][w], fontWeight: 'normal' }, style]} {...rest} />;
}
