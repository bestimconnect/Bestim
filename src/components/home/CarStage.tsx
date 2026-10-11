import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { FlatList, I18nManager, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated from 'react-native-reanimated';

import { EASE_OUT } from '@/lib/motion';
import { useColors } from '@/lib/theme';
import type { Vehicle } from '@/lib/queries';
import { vehicleArt } from '@/lib/vehicleArt';
import { useSettings } from '@/stores/settingsStore';

const HEIGHT = 200;

/** Home's car on a soft lime oval (Q94). Swipe between cars (Q56): the page it settles on becomes the current car. */
export function CarStage({ vehicle, vehicles }: { vehicle: Vehicle; vehicles: Vehicle[] }) {
  const { width } = useWindowDimensions();
  const c = useColors();
  const setCurrent = useSettings((s) => s.setCurrentVehicle);
  const pager = useRef<FlatList<Vehicle>>(null);
  const placed = useRef(false);
  const index = Math.max(0, vehicles.findIndex((v) => v.id === vehicle.id));
  const page = useRef(index); // the page on screen; differs from `index` only when the sheet switched the vehicle
  useEffect(() => {
    if (page.current === index) return;
    page.current = index;
    pager.current?.scrollToIndex({ index, animated: true });
  }, [index]);
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // iOS reports x from the physical left, while an RTL list starts at the right.
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const x = I18nManager.isRTL ? contentSize.width - layoutMeasurement.width - contentOffset.x : contentOffset.x;
    const i = Math.round(x / width);
    if (i === page.current || !vehicles[i]) return;
    page.current = i;
    Haptics.selectionAsync();
    setCurrent(vehicles[i].id);
  };
  // A true oval, placed by numbers: `self-center` doesn't centre an absolute view reliably.
  const ovalW = Math.min(270, width - 100);
  const ovalH = HEIGHT - 16;

  return (
    <View className="gap-1">
      <View style={{ height: HEIGHT }}>
        <View style={{ position: 'absolute', top: 4, left: (width - ovalW) / 2, width: ovalW, height: ovalH, borderRadius: ovalW / 2, backgroundColor: c.spot }} />
        <FlatList
          ref={pager}
          horizontal
          pagingEnabled
          data={vehicles}
          keyExtractor={(v) => v.id}
          scrollEnabled={vehicles.length > 1}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          initialScrollIndex={index}
          onContentSizeChange={() => {
            if (placed.current) return;
            placed.current = true;
            pager.current?.scrollToIndex({ index: page.current, animated: false });
          }}
          onMomentumScrollEnd={onSettle}
          renderItem={({ item }) => (
            <View style={{ width, height: HEIGHT }} className="items-center justify-end px-5 pb-2">
              <Image source={vehicleArt(item.vehicle_type)} contentFit="contain" style={{ width: '100%', height: HEIGHT - 20 }} />
            </View>
          )}
        />
      </View>
      {vehicles.length > 1 ? (
        <View className="flex-row justify-center gap-1.5">
          {vehicles.map((v) => (
            <Animated.View
              key={v.id}
              className={`h-1.5 rounded-full ${v.id === vehicle.id ? 'bg-lime' : 'bg-line'}`}
              style={{ width: v.id === vehicle.id ? 18 : 6, transitionProperty: 'width', transitionDuration: '220ms', transitionTimingFunction: EASE_OUT }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
