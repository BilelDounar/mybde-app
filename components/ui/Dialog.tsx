import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
  text: string;
  style?: DialogButtonStyle;
  onPress?: (inputValue: string) => void;
}

export interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: DialogButton[];
  showInput?: boolean;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
  inputKeyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  inputSecure?: boolean;
  onDismiss: () => void;
}

/**
 * Boîte de dialogue stylée (web et mobile) au design MyBDE.
 * Composant présentationnel piloté par `DialogProvider` (voir `context/DialogContext`).
 */
export function Dialog({
  visible,
  title,
  message,
  buttons,
  showInput = false,
  inputPlaceholder,
  inputDefaultValue = '',
  inputKeyboardType = 'default',
  inputSecure = false,
  onDismiss,
}: DialogProps) {
  const [inputValue, setInputValue] = useState(inputDefaultValue);

  useEffect(() => {
    if (visible) setInputValue(inputDefaultValue);
  }, [visible, inputDefaultValue]);

  const stacked = buttons.length > 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Pressable style={styles.overlay} onPress={onDismiss}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}

            {showInput && (
              <TextInput
                style={styles.input}
                placeholder={inputPlaceholder}
                placeholderTextColor={AppColors.textLight}
                value={inputValue}
                onChangeText={setInputValue}
                keyboardType={inputKeyboardType}
                secureTextEntry={inputSecure}
                autoFocus
              />
            )}

            <View style={[styles.actions, stacked && styles.actionsStacked]}>
              {buttons.map((button, index) => {
                const isCancel = button.style === 'cancel';
                const isDestructive = button.style === 'destructive';
                return (
                  <Pressable
                    key={`${button.text}-${index}`}
                    style={({ pressed }) => [
                      styles.button,
                      stacked && styles.buttonStacked,
                      isCancel && styles.buttonCancel,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => button.onPress?.(inputValue)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isCancel && styles.buttonTextCancel,
                        isDestructive && styles.buttonTextDestructive,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: AppColors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.18)',
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  input: {
    marginTop: Spacing.base,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.base,
    color: AppColors.text,
    minHeight: 48,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  actionsStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  button: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonStacked: {
    width: '100%',
  },
  buttonCancel: {
    backgroundColor: AppColors.surface,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: AppColors.primary,
  },
  buttonTextCancel: {
    color: AppColors.textSecondary,
  },
  buttonTextDestructive: {
    color: AppColors.danger,
  },
});
