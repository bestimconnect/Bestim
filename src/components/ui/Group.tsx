import { Children, createContext, useContext, type ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from './Card';

const GroupContext = createContext(false);
export const useInGroup = () => useContext(GroupContext);

/**
 * Related rows as one white card split by hairlines (the app's list rule). `Item`s inside lose their own card look.
 * The hairline runs the full width of the card (`inset` pulls it in from both ends if wanted).
 */
export function Group({ children, inset = 14 }: { children: ReactNode; inset?: number }) {
  const rows = Children.toArray(children);
  return (
    <GroupContext.Provider value>
      <Card>
        {rows.map((row, i) => (
          <View key={i}>
            {i ? <View className="h-px bg-line" style={{ marginHorizontal: inset }} /> : null}
            {row}
          </View>
        ))}
      </Card>
    </GroupContext.Provider>
  );
}
