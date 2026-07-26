import { useDialog } from '@/context/DialogContext';
import { useTransition } from '@/context/TransitionContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

/** Ouvre une invite pour saisir un code d'invitation à 6 chiffres et rejoindre le BDE correspondant. */
export function useJoinBde() {
  const dialog = useDialog();
  const { markDirty } = useTransition();
  const { refreshUser } = useAuth();

  return () => {
    dialog.prompt({
      title: 'Rejoindre un BDE',
      message: "Entrez le code d'invitation à 6 chiffres partagé par le BDE.",
      placeholder: '482913',
      keyboardType: 'numeric',
      confirmText: 'Rejoindre',
      onSubmit: async (value) => {
        const code = value.trim();
        if (!/^\d{6}$/.test(code)) {
          dialog.alert({ title: 'Code invalide', message: 'Le code doit contenir exactement 6 chiffres.' });
          return;
        }
        try {
          await api.joinBdeByCode(code);
          markDirty();
          await refreshUser();
          dialog.alert({ title: 'Bienvenue !', message: 'Vous avez rejoint le BDE avec succès.' });
        } catch (e) {
          dialog.alert({
            title: 'Erreur',
            message: e instanceof Error ? e.message : 'Impossible de rejoindre ce BDE',
          });
        }
      },
    });
  };
}
