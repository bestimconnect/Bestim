import { makeMutable } from 'react-native-reanimated';

/** Milliseconds since the splash's first frame (0..5000). The first welcome slide enters at 4,750. Stays 5000 once the splash is over. */
export const splashClock = makeMutable(0);
