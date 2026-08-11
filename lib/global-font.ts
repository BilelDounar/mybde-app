import { StyleSheet, Text, type TextProps } from 'react-native';

import { interForWeight } from '@/constants/theme';

type TextRender = (this: unknown, ...args: unknown[]) => React.ReactElement<TextProps>;

let installed = false;

/**
 * Applique Inter (à la bonne graisse) comme police par défaut de tout `Text`.
 * Les styles qui définissent déjà `fontFamily` (ex. titres Space Grotesk) sont
 * laissés intacts. À appeler une seule fois au démarrage de l'app.
 */
export function installGlobalFont() {
  if (installed) return;
  installed = true;

  const TextAny = Text as unknown as { render?: TextRender };
  const originalRender = TextAny.render;
  if (!originalRender) return;

  TextAny.render = function patchedRender(...args: unknown[]) {
    const element = originalRender.apply(this, args);
    const flattened = StyleSheet.flatten(element.props.style) ?? {};
    if (flattened.fontFamily) return element;

    // Important : renvoyer un style APLATI (objet), jamais un tableau. Sur
    // react-native-web (React 19), `Text.render` renvoie déjà l'élément hôte
    // (`<span>`), et lui repasser un tableau de styles fait planter React DOM
    // (« Failed to set an indexed property [0] on CSSStyleDeclaration »), ce qui
    // met en échec le rendu de tout Text — donc de toute l'application sur le web.
    return {
      ...element,
      props: {
        ...element.props,
        style: { fontFamily: interForWeight(flattened.fontWeight), ...flattened },
      },
    };
  };
}
