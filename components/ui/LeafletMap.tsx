import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { BorderRadius } from '@/constants/theme';

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  /** Hauteur fixe en pixels. Si omise, la carte remplit son conteneur parent
   * (utile pour un wrapper avec `aspectRatio`, ex. carte carrée). */
  height?: number;
}

// Carte Leaflet/OpenStreetMap rendue dans une WebView (aucune clé API requise,
// contrairement à Google/Apple Maps). Le HTML est généré localement, seules
// les tuiles OSM et le script Leaflet sont chargés depuis le réseau.
// Variante web : voir LeafletMap.web.tsx (react-native-webview ne supporte pas le web).
function buildHtml(latitude: number, longitude: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${latitude}, ${longitude}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    L.marker([${latitude}, ${longitude}]).addTo(map);
  </script>
</body>
</html>`;
}

export function LeafletMap({ latitude, longitude, height }: LeafletMapProps) {
  return (
    <View style={[styles.container, height != null ? { height } : StyleSheet.absoluteFillObject]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: buildHtml(latitude, longitude) }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
