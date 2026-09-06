// Ouverture des pages de paiement Stripe (Checkout hebergé) et fermeture du
// navigateur au retour.
//
// Pourquoi ne plus utiliser Linking.openURL :
//  - Linking.openURL sort de l'application et confie l'URL au navigateur par
//    defaut du telephone. Sur Android ce navigateur est quelconque (Chrome,
//    Firefox, Samsung Internet, un navigateur constructeur...) et tous ne
//    reconduisent pas de façon fiable une redirection vers un schema custom
//    comme fenuasim://payment-success. Quand la redirection est bloquee, le
//    client a paye mais ne revient jamais dans l'app.
//  - openBrowserAsync ouvre la page dans un onglet integre -- Chrome Custom
//    Tabs sur Android, SFSafariViewController sur iOS. Ces deux conteneurs
//    sont lances par l'app elle-meme et resolvent le schema fenuasim://
//    vers l'app, ce qui est precisement le comportement dont depend le retour
//    de paiement.
//
// Ce que ce changement ne fait PAS : refermer l'onglet automatiquement sur
// Android. expo-web-browser ne sait pas le faire (dismissBrowser est marque
// @platform ios, et le code de la librairie le dit explicitement). Le retour
// dans l'app se fait donc par le deep link, exactement comme avant -- la
// navigation reste assuree par expo-router via son propre abonnement Linking,
// et n'est pas modifiee ici.
import * as WebBrowser from 'expo-web-browser'

/**
 * Ouvre une URL Stripe Checkout dans le navigateur integre.
 * Ne navigue pas : le retour dans l'app passe par le deep link fenuasim://
 * declare dans app.json, resolu par expo-router.
 */
export async function openCheckout(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url)
}

/**
 * A appeler au montage des ecrans de retour de paiement.
 * Sur iOS, referme le SFSafariViewController reste ouvert derriere l'app.
 * Sur Android, dismissBrowser n'existe pas et leve une erreur : on l'ignore
 * volontairement plutot que de tester la plateforme, pour que ce soit la
 * disponibilite reelle de l'API qui decide, pas une hypothese.
 */
export function closeCheckoutBrowser(): void {
  WebBrowser.dismissBrowser().catch(() => {})
}
