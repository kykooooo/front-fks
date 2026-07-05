import React, { useMemo, useRef } from "react";
import { PanResponder, View, useWindowDimensions } from "react-native";
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
  // Largeur live via hook (suit rotation / multitâche iPad) ; capturee dans un
  // ref car le PanResponder n'est cree qu'une fois (closure figee au montage).
  const { width } = useWindowDimensions();
  const widthRef = useRef(width);
  widthRef.current = width;
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
        if (x0 > EDGE_SLOP && x0 < widthRef.current - EDGE_SLOP) return false;
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
