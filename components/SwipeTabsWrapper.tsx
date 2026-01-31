import React, { useMemo, useRef } from "react";
import { Dimensions, PanResponder, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

type SwipeTabsWrapperProps = {
  children: React.ReactNode;
  tabOrder: string[];
  currentTab: string;
};

const EDGE_SLOP = 24;
const SWIPE_THRESHOLD = 60;

export function SwipeTabsWrapper({
  children,
  tabOrder,
  currentTab,
}: SwipeTabsWrapperProps) {
  const nav = useNavigation<any>();
  const currentIndex = useMemo(
    () => tabOrder.findIndex((tab) => tab === currentTab),
    [tabOrder, currentTab]
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        const { dx, dy, x0 } = gesture;
        if (Math.abs(dx) < 12) return false;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) return false;
        const width = Dimensions.get("window").width;
        if (x0 > EDGE_SLOP && x0 < width - EDGE_SLOP) return false;
        return true;
      },
      onPanResponderRelease: (_, gesture) => {
        const { dx } = gesture;
        if (dx > SWIPE_THRESHOLD && currentIndex > 0) {
          nav.navigate(tabOrder[currentIndex - 1]);
        } else if (dx < -SWIPE_THRESHOLD && currentIndex < tabOrder.length - 1) {
          nav.navigate(tabOrder[currentIndex + 1]);
        }
      },
      onPanResponderTerminate: (_, gesture) => {
        const { dx } = gesture;
        if (dx > SWIPE_THRESHOLD && currentIndex > 0) {
          nav.navigate(tabOrder[currentIndex - 1]);
        } else if (dx < -SWIPE_THRESHOLD && currentIndex < tabOrder.length - 1) {
          nav.navigate(tabOrder[currentIndex + 1]);
        }
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
