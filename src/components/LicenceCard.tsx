import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Pencil } from 'lucide-react-native';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { PlateView } from '@/components/Plate';
import { PressableScale, Sheen, Text } from '@/components/ui';
import { planName, useEntitlements } from '@/lib/entitlements';
import { useProfile, useVehicles } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { shadows, useColors } from '@/lib/theme';

type Look = { bg: string; ink: string; muted: string; line: string; accent: string; photo: string; btnBg: string; btnFg: string; glow: string; glowOpacity: number; glowAt: 'tr' | 'tl' };

/** One look per plan (founder, 2026-11-03): Basic is the light card, Pro the dark green one, Max the lime foil. */
function useLook(planId?: string): Look {
  const c = useColors();
  if (planId === 'max') return { bg: '#D3F53D', ink: '#1B2620', muted: 'rgba(27,38,32,0.7)', line: 'rgba(27,38,32,0.16)', accent: '#1B2620', photo: '#F4FCC8', btnBg: '#1B2620', btnFg: '#D3F53D', glow: '#FFFFFF', glowOpacity: 0.55, glowAt: 'tl' };
  if (planId === 'pro') return { bg: '#1F2B25', ink: '#F5F7F5', muted: 'rgba(245,247,245,0.62)', line: 'rgba(255,255,255,0.1)', accent: '#D3F53D', photo: '#3A4D43', btnBg: '#D3F53D', btnFg: '#222E29', glow: '#D3F53D', glowOpacity: 0.14, glowAt: 'tr' };
  return { bg: c.white, ink: c.ink, muted: c.muted, line: c.line, accent: c.teal, photo: c.mint, btnBg: c.ink, btnFg: c.paper, glow: '#08736F', glowOpacity: 0.08, glowAt: 'tr' };
}

/** The top of Account (decisions Q130): a driver-licence style card with the photo, name, plan and the plates of the user's cars. */
export function LicenceCard({ onEdit }: { onEdit: () => void }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const session = useSession();
  const { data: profile } = useProfile();
  const ent = useEntitlements().data;
  const vehicles = useVehicles().data ?? [];
  const k = useLook(ent?.plan_id);
  const plates = vehicles.map((v) => v.plate_number?.trim()).filter(Boolean) as string[];
  const id = (session?.user.id ?? '').replace(/-/g, '').slice(0, 8).toUpperCase();
  const since = profile?.created_at ? format(parseISO(profile.created_at), 'MMM yyyy', { locale: isAr ? ar : enUS }) : '—';
  const max = ent?.plan_id === 'max';
  const seal = max ? '#1B2620' : '#D3F53D'; // lime on every card but the lime one
  const ring = max ? '#D3F53D' : k.bg; // the cut-out ring takes the card's colour
  const track = isAr ? 0 : 1.4;
  const label = (s: string) => (
    <Text variant="caption" numberOfLines={1} className="uppercase" style={{ color: k.muted, fontSize: isAr ? 11 : 9.5, lineHeight: 12, letterSpacing: track }}>{s}</Text>
  );
  const bold = { fontFamily: isAr ? 'Tajawal_700Bold' : 'Poppins_700Bold' } as const;

  return (
    <View className="gap-3 overflow-hidden rounded-[22px] px-4 py-3.5" style={{ backgroundColor: k.bg, borderWidth: 1, borderColor: k.line, boxShadow: shadows.lift }}>
      <Sheen color={k.glow} opacity={k.glowOpacity} glow={k.glowAt} radius={1.1} />
      <View pointerEvents="none" className="absolute -end-10 -top-10">
        <Svg width={160} height={160}>
          {[30, 42, 54, 66, 78].map((r) => <Circle key={r} cx={80} cy={80} r={r} fill="none" stroke={k.accent} strokeOpacity={0.09} strokeWidth={1} />)}
        </Svg>
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <View className="h-[26px] w-[26px] items-center justify-center rounded-full" style={{ backgroundColor: k.btnBg }}>
            <Text style={{ ...bold, color: k.btnFg, fontSize: 14, lineHeight: 18 }}>b</Text>
          </View>
          <View className="min-w-0 shrink">
            <Text style={{ ...bold, color: k.ink, fontSize: 11, lineHeight: 13, letterSpacing: isAr ? 0 : 1.8 }}>BESTIM</Text>
            <Text variant="caption" numberOfLines={1} className="uppercase" style={{ color: k.muted, fontSize: 10, lineHeight: 13, letterSpacing: isAr ? 0 : 1 }}>{t('account.card.title')}</Text>
          </View>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('account.card.edit')} onPress={onEdit} className="h-[30px] flex-row items-center gap-1.5 rounded-full px-3" style={{ backgroundColor: k.btnBg }}>
          <Pencil size={13} color={k.btnFg} strokeWidth={2.4} />
          <Text style={{ ...bold, color: k.btnFg, fontSize: 12, lineHeight: 16 }}>{t('account.card.edit')}</Text>
        </PressableScale>
      </View>

      <View className="flex-row gap-3.5">
        <View style={{ borderWidth: 2, borderColor: k.line, borderRadius: 14, overflow: 'hidden', backgroundColor: k.photo }}>
          <Avatar path={profile?.avatar_url} name={profile?.full_name} size={80} square />
        </View>
        <View className="min-w-0 flex-1 justify-between gap-1.5">
          <View>
            {label(t('account.card.name'))}
            <Text variant="heading" numberOfLines={1} style={{ color: k.ink, fontSize: 19, lineHeight: 24 }}>{profile?.full_name?.trim() || t('account.myAccount')}</Text>
            <Text variant="caption" numberOfLines={1} style={{ color: k.muted }}>{session?.user.email}</Text>
          </View>
          <View className="flex-row gap-5">
            <View>
              {label(t('account.card.since'))}
              <Text variant="label" style={{ color: k.ink, fontSize: 13, lineHeight: 18 }}>{since}</Text>
            </View>
            <View className="items-start">
              {label(t('account.card.plan'))}
              <View style={{ borderWidth: 1.5, borderColor: k.accent, borderRadius: 6, paddingHorizontal: 8 }}>
                <Text style={{ ...bold, color: k.accent, fontSize: 12.5, lineHeight: 18 }}>{planName(ent) || '—'}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View className="gap-1.5">
        {label(t('account.card.plates'))}
        {plates.length ? (
          <View className="flex-row flex-wrap gap-1.5">
            {plates.slice(0, 3).map((p) => <PlateView key={p} plate={p} size="sm" />)}
            {plates.length > 3 ? <Text variant="caption" className="self-center" style={{ color: k.muted }}>{`+${plates.length - 3}`}</Text> : null}
          </View>
        ) : (
          <Text variant="caption" style={{ color: k.muted }}>{t('account.card.noPlates')}</Text>
        )}
      </View>

      <View className="flex-row items-center justify-between gap-3 pt-2.5" style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: k.line }}>
        <Text variant="caption" numberOfLines={1} style={{ color: k.muted, fontSize: 10.5, letterSpacing: 1.4, writingDirection: 'ltr' }}>{`${t('account.card.id')} BST · ${id.slice(0, 4)} · ${id.slice(4)}`}</Text>
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={11} fill={seal} fillOpacity={0.92} />
          <Circle cx={12} cy={12} r={7} fill="none" stroke={ring} strokeWidth={1.5} />
          <Circle cx={12} cy={12} r={2.5} fill={ring} />
        </Svg>
      </View>
    </View>
  );
}
