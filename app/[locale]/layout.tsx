import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono, Source_Sans_3 } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale, localeTag, routing } from "@/i18n/routing";
import "../globals.css";
import "temml/dist/Temml-Local.css";
import { VisualViewportMetrics } from "@/components/visual-viewport";

/**
 * The viewport declaration (#230). `interactive-widget=resizes-content` is the
 * standards-track way to tell a browser that an on-screen keyboard takes room
 * out of the layout viewport instead of merely drawing over it (Safari 26,
 * Chrome 108+). It is asked for because it is the honest answer: where the
 * browser resizes the layout viewport, `100dvh`, `vh` and every fixed surface
 * become the room the learner actually has. `lib/visual-viewport.ts` measures
 * the same room where a browser does not honour it — iOS 18 and 26 shipped the
 * keyboard behaviour this ticket reports, and no viewport meta tag changes it.
 *
 * `width` and `initial-scale` are Next's own defaults; they are written out
 * here because this declaration is read as the app's viewport contract, not as
 * a diff against a framework default.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

/**
 * Pre-paint theme script: apply the stored theme (or the OS preference)
 * to <html> before first paint, so there is no flash. `useTheme` reads the
 * same source on mount, so React's initial state always matches the DOM.
 *
 * Rendered only during SSR: the browser executes the script while parsing
 * the initial HTML, and the client must never render a `<script>` tag of
 * its own (React 19 warns about client-created scripts, which never
 * execute). `suppressHydrationWarning` covers the server-script vs
 * client-null diff.
 */
function ThemeInitScript() {
  if (typeof window !== "undefined") return null;
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var t=localStorage.getItem("la:theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.classList.add(t)}catch(e){document.documentElement.classList.add("dark")}})();`,
      }}
    />
  );
}

/* The Answer Sheet type stack:
 * - Archivo — the printed-form grotesque for record headers, sheet titles,
 *   and the wordmark.
 * - Source Sans 3 — the plain, high-legibility body voice (all ages).
 * - JetBrains Mono — form codes, counters, and measured data only.
 * CJK rendering falls through to the platform Chinese face via the
 * --font-sans stack in globals.css. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

/**
 * The served locales — one static shell per locale. The pages under this
 * layout are static shells: they render the view and resolve no data; the
 * views own their fetches in the browser (#87).
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(locale) ? locale : routing.defaultLocale,
    namespace: "app",
  });
  return {
    title: {
      default: t("title"),
      template: `${t("title")}: %s`,
    },
    description: t("description"),
  };
}

/**
 * Root layout (the `[locale]` segment is the app root — `proxy.ts` redirects
 * every locale-less path to `/{locale}…`). Guards unsupported locales with
 * `notFound()`, sets the per-request locale, and hands the messages to the
 * client via `NextIntlClientProvider` so `useTranslations` works in every
 * client component below.
 */
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={localeTag(locale)}
      className={`${archivo.variable} ${sourceSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
      </head>
      <body className="fixed inset-x-0 top-[var(--visual-viewport-offset-top)] h-[var(--visual-viewport-height)] overflow-hidden">
        {/* The measure the shell is sized from, kept current for the life of
            the page (#230). It sits here, next to the pre-paint script, because
            both are the shell's own boot-time business: one settles which theme
            the page paints with, the other which room it paints into. */}
        <VisualViewportMetrics />
        <NextIntlClientProvider locale={locale} messages={await getMessages()}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
