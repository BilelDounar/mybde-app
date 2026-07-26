import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useTransition } from '@/context/TransitionContext';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { flashIfDirty } = useTransition();
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
      onPress={(ev) => {
        if (!props.accessibilityState?.selected) flashIfDirty();
        props.onPress?.(ev);
      }}
    />
  );
}
