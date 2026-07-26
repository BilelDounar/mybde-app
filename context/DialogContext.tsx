import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Dialog, type DialogButton } from '@/components/ui/Dialog';

// ─── Types ─────────────────────────────────────────────────

type Action = () => void | Promise<void>;

interface AlertOptions {
  title: string;
  message?: string;
  buttonText?: string;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: Action;
  onCancel?: Action;
}

interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  secure?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
}

interface ChooseChoice {
  text: string;
  onPress?: Action;
  destructive?: boolean;
}

interface ChooseOptions {
  title: string;
  message?: string;
  choices: ChooseChoice[];
  cancelText?: string;
}

interface DialogContextType {
  alert: (options: AlertOptions) => void;
  confirm: (options: ConfirmOptions) => void;
  prompt: (options: PromptOptions) => void;
  choose: (options: ChooseOptions) => void;
}

// ─── Context ───────────────────────────────────────────────

const DialogContext = createContext<DialogContextType | null>(null);

interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
  showInput?: boolean;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
  inputKeyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  inputSecure?: boolean;
}

const isWeb = Platform.OS === 'web';
// Alert.prompt n'existe que sur iOS → modale stylée ailleurs.
const usePromptModal = Platform.OS !== 'ios';

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const close = useCallback(() => setState(null), []);

  const run = useCallback(
    (action?: (value: string) => void | Promise<void>, value = '') => {
      close();
      action?.(value);
    },
    [close],
  );

  const alert = useCallback(
    ({ title, message, buttonText = 'OK' }: AlertOptions) => {
      if (!isWeb) {
        Alert.alert(title, message, [{ text: buttonText }]);
        return;
      }
      setState({
        title,
        message,
        buttons: [{ text: buttonText, onPress: () => close() }],
      });
    },
    [close],
  );

  const confirm = useCallback(
    ({
      title,
      message,
      confirmText = 'Confirmer',
      cancelText = 'Annuler',
      destructive,
      onConfirm,
      onCancel,
    }: ConfirmOptions) => {
      if (!isWeb) {
        Alert.alert(title, message, [
          { text: cancelText, style: 'cancel', onPress: onCancel },
          {
            text: confirmText,
            style: destructive ? 'destructive' : 'default',
            onPress: onConfirm,
          },
        ]);
        return;
      }
      setState({
        title,
        message,
        buttons: [
          { text: cancelText, style: 'cancel', onPress: () => run(onCancel) },
          {
            text: confirmText,
            style: destructive ? 'destructive' : 'default',
            onPress: () => run(onConfirm),
          },
        ],
      });
    },
    [run],
  );

  const prompt = useCallback(
    ({
      title,
      message,
      placeholder,
      defaultValue = '',
      confirmText = 'Valider',
      cancelText = 'Annuler',
      keyboardType = 'default',
      secure = false,
      onSubmit,
    }: PromptOptions) => {
      if (!usePromptModal) {
        Alert.prompt(
          title,
          message,
          [
            { text: cancelText, style: 'cancel' },
            { text: confirmText, onPress: (value?: string) => onSubmit(value ?? '') },
          ],
          secure ? 'secure-text' : 'plain-text',
          defaultValue,
          keyboardType,
        );
        return;
      }
      setState({
        title,
        message,
        showInput: true,
        inputPlaceholder: placeholder,
        inputDefaultValue: defaultValue,
        inputKeyboardType: keyboardType,
        inputSecure: secure,
        buttons: [
          { text: cancelText, style: 'cancel', onPress: () => close() },
          {
            text: confirmText,
            onPress: (value: string) => run((v) => onSubmit(v), value),
          },
        ],
      });
    },
    [close, run],
  );

  const choose = useCallback(
    ({ title, message, choices, cancelText = 'Annuler' }: ChooseOptions) => {
      if (!isWeb) {
        Alert.alert(title, message, [
          { text: cancelText, style: 'cancel' },
          ...choices.map((c) => ({
            text: c.text,
            style: (c.destructive ? 'destructive' : 'default') as 'destructive' | 'default',
            onPress: c.onPress,
          })),
        ]);
        return;
      }
      setState({
        title,
        message,
        buttons: [
          ...choices.map((c) => ({
            text: c.text,
            style: (c.destructive ? 'destructive' : 'default') as DialogButton['style'],
            onPress: () => run(c.onPress),
          })),
          { text: cancelText, style: 'cancel' as const, onPress: () => close() },
        ],
      });
    },
    [close, run],
  );

  const value = useMemo(
    () => ({ alert, confirm, prompt, choose }),
    [alert, confirm, prompt, choose],
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
      {state && (
        <Dialog
          visible
          title={state.title}
          message={state.message}
          buttons={state.buttons}
          showInput={state.showInput}
          inputPlaceholder={state.inputPlaceholder}
          inputDefaultValue={state.inputDefaultValue}
          inputKeyboardType={state.inputKeyboardType}
          inputSecure={state.inputSecure}
          onDismiss={close}
        />
      )}
    </DialogContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────

export function useDialog(): DialogContextType {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
