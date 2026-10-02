import { cubicBezier, Easing, FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

// Shared motion values (decisions Q57). Feel: between calm and playful — short, with a light spring on entrances.
// Only transform/opacity move. Never animate tab switches, numbers the user reads, or anything idle.
export const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1); // CSS transitions: things arriving or reacting
export const BACK_OUT = cubicBezier(0.34, 1.4, 0.64, 1); // release after a press: a small overshoot
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

/** Row / text entrance: fade in and rise 10pt, 50ms apart, light spring. Fires on mount only. */
export const rise = (index = 0) =>
  FadeInDown.withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })
    .springify(450)
    .dampingRatio(0.75)
    .delay(index * 50);

/** Rare happy moments (success tick, empty-state badge): pops in from 80%. */
export const POP = ZoomIn.withInitialValues({ transform: [{ scale: 0.8 }] }).springify(500).dampingRatio(0.55);

/** Content swapped in place (Home when the vehicle changes). */
export const SWAP = FadeIn.duration(200).easing(easeOut);
