import Head from 'expo-router/head';

interface PageTitleProps {
  /** Nom de la page (préfixe le titre de l'onglet : « {title} · MyBDE »). */
  title?: string;
}

/**
 * Renseigne le titre de l'onglet du navigateur (web) pour chaque page.
 * No-op sur natif. À placer en tête du rendu de chaque écran.
 */
export function PageTitle({ title }: PageTitleProps) {
  const full = title ? `${title} · MyBDE` : 'MyBDE';
  return (
    <Head>
      <title>{full}</title>
    </Head>
  );
}
