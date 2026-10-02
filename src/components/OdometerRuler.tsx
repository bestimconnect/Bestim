import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { FlatList, I18nManager, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Text } from '@/components/ui';

const SEG_W = 80; // one labelled segment: 10 ticks, the long one in the middle
const SEGMENTS = 2001; // 0 → 2,000,000 km (or 200,000 h)
const TICKS = Array.from({ length: 10 }, (_, k) => k);
const DATA = Array.from({ length: SEGMENTS }, (_, i) => i);

type Props = {
  value: number;
  onChange: (v: number) => void;
  /** Units per labelled segment: 1000 for km/mi, 100 for hours. The reading snaps to 1/100 of it. */
  segment: number;
};

function Segment({ label }: { label: string }) {
  return (
    <View style={{ width: SEG_W }} className="h-[64px]">
      {TICKS.map((k) => (
        <View
          key={k}
          className="absolute top-0 w-px bg-onpanel"
          style={{ left: k * (SEG_W / 10), height: k === 5 ? 30 : k === 0 ? 20 : 12, opacity: k === 5 ? 0.9 : 0.35 }}
        />
      ))}
      <Text variant="caption" className="absolute bottom-0 w-full text-center text-onpanel" style={{ opacity: 0.6 }}>{label}</Text>
    </View>
  );
}

/** Screen 25's ruler (decisions Q53): native horizontal scroll, the reading sits under the fixed lime marker. Goes on `bg-panel`. */
export function OdometerRuler({ value, onChange, segment }: Props) {
  const list = useRef<FlatList<number>>(null);
  const [width, setWidth] = useState(0);
  const current = useRef(value);
  const byUser = useRef(false); // scroll events from our own scrollToOffset must not round a typed reading
  const placed = useRef(false);
  const step = segment / 100;
  const pad = Math.max(0, width / 2 - SEG_W / 2);
  const toX = (v: number) => (v / segment) * SEG_W;

  useEffect(() => {
    if (value === current.current) return;
    current.current = value;
    byUser.current = false;
    list.current?.scrollToOffset({ offset: toX(value), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!byUser.current) return;
    // iOS reports x from the physical left, while an RTL list starts at the right.
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const x = I18nManager.isRTL ? contentSize.width - layoutMeasurement.width - contentOffset.x : contentOffset.x;
    const v = Math.round((Math.max(0, x) / SEG_W) * segment / step) * step;
    if (v === current.current) return;
    const tick = segment / 10;
    if (Math.floor(v / tick) !== Math.floor(current.current / tick)) Haptics.selectionAsync();
    current.current = v;
    onChange(v);
  };

  return (
    <View className="h-[64px]" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width ? (
        <FlatList
          ref={list}
          horizontal
          inverted={I18nManager.isRTL} // numbers grow to the right in Arabic too (founder, decisions Q53)
          data={DATA}
          keyExtractor={String}
          renderItem={({ item }) => <Segment label={(item * segment).toLocaleString('en-US')} />}
          getItemLayout={(_, index) => ({ length: SEG_W, offset: pad + index * SEG_W, index })}
          initialScrollIndex={Math.min(SEGMENTS - 1, Math.floor(value / segment))}
          onContentSizeChange={() => {
            if (placed.current) return;
            placed.current = true;
            list.current?.scrollToOffset({ offset: toX(current.current), animated: false });
          }}
          ListHeaderComponent={<View style={{ width: pad }} />}
          ListFooterComponent={<View style={{ width: pad }} />}
          showsHorizontalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
          onScrollBeginDrag={() => (byUser.current = true)}
          onScroll={onScroll}
        />
      ) : null}
      <View pointerEvents="none" className="absolute top-0 items-center" style={{ left: width / 2 - 5, width: 10 }}>
        <View style={{ borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#D3F53D', marginTop: -8 }} />
        <View className="h-[38px] w-[3px] rounded-full bg-lime" />
      </View>
    </View>
  );
}
