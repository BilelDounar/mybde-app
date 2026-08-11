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

    // Le style doit rester un objet : `element` est déjà l'élément hôte, et
    // react-native-web transmet son `style` tel quel au DOM. Un tableau y ferait
    // itérer React DOM sur les index ("0", "1"…) — d'où « Indexed property
    // setter is not supported » et un écran blanc (visible sur les Text imbriqués,
    // rendus en <span>).
    return {
      ...element,
      props: {
        ...element.props,
        style: StyleSheet.flatten([
          { fontFamily: interForWeight(flattened.fontWeight) },
          element.props.style,
        ]),
      },
    };
  };
}
