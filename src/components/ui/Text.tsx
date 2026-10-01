import { Text as RNText, type TextProps } from 'react-native';
import { useTranslation } from 'react-i18next';

const variants = {
  display: { size: 'text-display', bold: true },
  title: { size: 'text-title', bold: true },
  heading: { size: 'text-heading', bold: true },
  body: { size: 'text-body', bold: false },
  label: { size: 'text-label', bold: true },
  caption: { size: 'text-caption', bold: false },
  number: { size: 'text-number', bold: true, latin: true },
  'small-number': { size: 'text-small-number', bold: true, latin: true },
} as const;

type Props = TextProps & { variant?: keyof typeof variants; className?: string };

/** Tajawal for Arabic, Poppins for English and numbers (spec §4). Defaults to ink; override color via className. */
export function Text({ variant = 'body', className = '', ...rest }: Props) {
  const { i18n } = useTranslation();
  const v = variants[variant];
  const latin = 'latin' in v || i18n.language === 'en';
  const family = `${latin ? 'Poppins' : 'Tajawal'}_${v.bold ? '700Bold' : '400Regular'}`;
  // NativeWind resolves conflicting classes by stylesheet order, not className order, so only default to ink when no color is given.
  const color = /(^|\s)text-(ink|muted|teal|paper|white|lime|danger|coral|onpanel|\[#)/.test(className) ? '' : 'text-ink';
  return (
    <RNText
      className={`${v.size} ${color} text-left ${className}`}
      style={{ fontFamily: family }}
      {...rest}
    />
  );
}
