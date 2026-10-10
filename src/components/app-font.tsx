import { Inter } from 'next/font/google';

/**
 * Inter for the signed-in app; the public site keeps Manrope.
 *
 * The root layout puts Manrope on <html> as `--font-sans`, and the
 * marketing pages share that body font, so changing it there would
 * change the landing page too. Instead each app layout renders this,
 * and while it is mounted the style below points `--font-sans` at
 * Inter for the whole document.
 *
 * The whole document, not a wrapper div: dialogs, dropdowns, popovers
 * and toasts are portalled straight into <body>, outside any wrapper,
 * and would otherwise stay in Manrope. The rule lives in the rendered
 * <style> element, so it is in the server HTML (no flash) and goes away
 * when a client navigation leaves the app for a public page.
 *
 * `html:root` (0,1,1) outranks the class next/font puts on <html>
 * (0,1,0) regardless of stylesheet order. Imported only by app layouts,
 * so Inter is preloaded on app routes and never downloaded by the
 * landing page.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export function AppFont() {
  return <style>{`html:root{--font-sans:${inter.style.fontFamily};}`}</style>;
}
