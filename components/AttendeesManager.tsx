import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { AppColors, BorderRadius, FontFamily, FontSizes, Spacing } from '@/constants/theme';
import { api } from '@/services/api';
import type { useDialog } from '@/context/DialogContext';

interface Attendee {
  id: string;
  ticketNumber: string;
  qrCode: string;
  status: string;
  ticketType: string;
  seatInfo?: string | null;
  purchasedAt: string;
  user: { id: string; displayName: string; email: string; profilePicture?: string | null };
}

interface Props {
  eventId: string;
  dialog: ReturnType<typeof useDialog>;
  /** Appelé après un changement (validation, présence, retrait) pour rafraîchir l'appelant. */
  onChanged?: () => void;
}

/**
 * Outil de gestion des présences d'un événement : liste des participants (y
 * compris ceux qui ne sont pas membres du BDE), validation par scan caméra ou
 * saisie du code QR, marquage présent/absent et retrait. Réutilisé par la modale
 * de gestion et par l'onglet Présence des admins BDE.
 */
export function AttendeesManager({ eventId, dialog, onChanged }: Props) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [qrInput, setQrInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const isWeb = Platform.OS === 'web';

  const load = useCallback(async () => {
    try {
      setAttendees(await api.getEventAttendees(eventId));
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Chargement impossible' });
    }
  }, [eventId, dialog]);

  useEffect(() => {
    setScanning(false);
    setQrInput('');
    load();
  }, [load]);

  const validate = async (code?: string) => {
    const qrCode = (code ?? qrInput).trim();
    if (!qrCode) return;
    try {
      const ticket = await api.validateTicket(eventId, qrCode);
      setQrInput('');
      await load();
      onChanged?.();
      dialog.alert({
        title: 'Présence validée',
        message: `Billet ${ticket.ticketNumber} — ${ticket.user.displayName}`,
      });
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Validation impossible' });
    }
  };

  const setPresence = async (ticketId: string, present: boolean) => {
    try {
      await api.setAttendeePresence(eventId, ticketId, present);
      await load();
      onChanged?.();
    } catch (e) {
      dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Action impossible' });
    }
  };

  const remove = (ticketId: string, name: string) => {
    dialog.confirm({
      title: 'Retirer le participant',
      message: `${name} sera retiré de l'événement. Son billet sera annulé et remboursé s'il était payant.`,
      confirmText: 'Retirer',
      destructive: true,
      onConfirm: async () => {
        try {
          await api.removeAttendee(eventId, ticketId);
          await load();
          onChanged?.();
        } catch (e) {
          dialog.alert({ title: 'Erreur', message: e instanceof Error ? e.message : 'Action impossible' });
        }
      },
    });
  };

  const handleScanPress = async () => {
    if (isWeb) {
      dialog.alert({ title: 'Scanner indisponible', message: 'La caméra n\'est pas disponible sur le web. Saisissez le code manuellement.' });
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        dialog.alert({ title: 'Permission requise', message: 'Autorisez l\'accès à la caméra pour scanner les QR codes.' });
        return;
      }
    }
    setScanning(true);
  };

  const handleBarcode = ({ data }: { data: string }) => {
    if (!data || !scanning) return;
    setScanning(false);
    setQrInput(data);
    validate(data);
  };

  const validCount = attendees.filter((a) => ['valid', 'used'].includes(a.status.toLowerCase())).length;
  const usedCount = attendees.filter((a) => a.status.toLowerCase() === 'used').length;

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.stats}>
        {attendees.length} inscrit{attendees.length > 1 ? 's' : ''} · {usedCount}/{validCount} présence{validCount > 1 ? 's' : ''} validée{validCount > 1 ? 's' : ''}
      </Text>

      <View style={styles.qrRow}>
        <TextInput
          style={styles.qrInput}
          placeholder="Saisir le code QR du billet..."
          placeholderTextColor={AppColors.textLight}
          value={qrInput}
          onChangeText={setQrInput}
          onSubmitEditing={() => validate()}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button title="" icon={<Ionicons name="barcode-outline" size={24} color={AppColors.white} />} onPress={handleScanPress} size="md" />
        <Button title="Valider" onPress={() => validate()} size="md" />
      </View>

      {scanning && (
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcode}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraTarget} />
            </View>
          </CameraView>
          <Button title="Annuler le scan" onPress={() => setScanning(false)} size="sm" variant="outline" fullWidth style={{ marginTop: Spacing.sm }} />
        </View>
      )}

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {attendees.length === 0 ? (
          <Text style={styles.empty}>Aucun participant inscrit</Text>
        ) : (
          attendees.map((a) => {
            const status = a.status.toLowerCase();
            const isPresent = status === 'used';
            const isCancelled = status === 'cancelled' || status === 'refunded';
            return (
              <Card key={a.id} variant="outlined" style={styles.card}>
                <View style={styles.row}>
                  <Avatar name={a.user.displayName} uri={a.user.profilePicture} size={40} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <Text style={styles.title}>{a.user.displayName}</Text>
                    <Text style={styles.meta}>{a.user.email} · N° {a.ticketNumber}</Text>
                  </View>
                  <Badge
                    label={isPresent ? 'Présent' : status === 'valid' ? 'Inscrit' : isCancelled ? 'Annulé' : a.status}
                    variant={isPresent ? 'success' : status === 'valid' ? 'info' : 'neutral'}
                    size="sm"
                  />
                </View>
                {!isCancelled && (
                  <View style={styles.actions}>
                    <Button
                      title={isPresent ? 'Marquer absent' : 'Marquer présent'}
                      variant="outline"
                      size="sm"
                      onPress={() => setPresence(a.id, !isPresent)}
                    />
                    <Button title="Retirer" variant="danger" size="sm" onPress={() => remove(a.id, a.user.displayName)} />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary, marginBottom: Spacing.base },
  qrRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  qrInput: { flex: 1, backgroundColor: AppColors.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: FontSizes.base, color: AppColors.text, borderWidth: 1, borderColor: AppColors.border },
  cameraWrap: { marginBottom: Spacing.base, overflow: 'hidden', borderRadius: BorderRadius.md },
  camera: { width: '100%', aspectRatio: 1, borderRadius: BorderRadius.md },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  cameraTarget: { width: 200, height: 200, borderWidth: 2, borderColor: AppColors.white, borderRadius: BorderRadius.lg, backgroundColor: 'transparent' },
  card: { marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontFamily: FontFamily.displaySemibold, fontSize: FontSizes.base, color: AppColors.text },
  meta: { fontFamily: FontFamily.body, fontSize: FontSizes.sm, color: AppColors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  empty: { fontFamily: FontFamily.body, fontSize: FontSizes.base, color: AppColors.textLight, textAlign: 'center', paddingVertical: Spacing.xl },
});
