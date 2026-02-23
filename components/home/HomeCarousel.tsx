import React, { useRef, useState } from "react";
import { View, StyleSheet, Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { theme } from "../../constants/theme";

const palette = theme.colors;
const { width: screenWidth } = Dimensions.get("window");

export type CarouselItem = {
  id: string;
  node: React.ReactNode;
};

type Props = {
  items: CarouselItem[];
};

export default function HomeCarousel({ items }: Props) {
  const listRef = useRef<FlatList<CarouselItem>>(null);
  const cardWidth = Math.min(320, screenWidth * 0.78);
  const gap = 12;
  const snapToInterval = cardWidth + gap;
  const [index, setIndex] = useState(0);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const i = Math.round(offset / snapToInterval);
    setIndex(i);
  };

  return (
    <View>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapToInterval}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <View style={[styles.cardWrap, { width: cardWidth }]}>{item.node}</View>
        )}
      />
      <View style={styles.dotsRow}>
        {items.map((_, i) => (
          <View
            key={`dot_${i}`}
            style={[
              styles.dot,
              i === index ? styles.dotActive : null,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
  },
  separator: {
    width: 12,
  },
  cardWrap: {
    width: "100%",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
  },
  dotActive: {
    width: 16,
    backgroundColor: palette.accent,
  },
});
