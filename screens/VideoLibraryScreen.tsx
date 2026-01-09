// screens/VideoLibraryScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VideoLibraryScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.title}>Bibliothèque vidéo</Text>
        <Text style={styles.subtitle}>Bientôt : démonstrations des exercices et playlists.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: 8, color: '#666', textAlign: 'center' },
});
