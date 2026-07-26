import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BorderRadius } from '@/constants/theme';

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  /** Hauteur fixe en pixels. Si omise, la carte remplit son conteneur parent
   * (utile pour un wrapper avec `aspectRatio`, ex. carte carrée). */
  height?: number;
}

// Variante web : react-native-webview n'a pas d'implémentation navigateur,
// on utilise directement l'embed officiel OpenStreetMap (iframe, sans clé API).
export function LeafletMap({ latitude, longitude, height }: LeafletMapProps) {
  const delta = 0.01;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join('%2C');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${latitude}%2C${longitude}`;

  return (
    <View style={[styles.container, height != null ? { height } : StyleSheet.absoluteFillObject]}>
      <iframe title="Carte" src={src} style={{ border: 0, width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
});
