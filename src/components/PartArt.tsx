import { Image } from 'expo-image';

import { partArt, type ArtState } from '@/lib/partArt';

/** A part picture in a status colour (`ok` when omitted), contained in a `size` box. Never mirrored. */
export function PartArt({ nameEn, size, state }: { nameEn?: string | null; size: number; state?: ArtState }) {
  return <Image accessible={false} source={partArt(nameEn, state ?? 'ok')} contentFit="contain" style={{ width: size, height: size }} />;
}
