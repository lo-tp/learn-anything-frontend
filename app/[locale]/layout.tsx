import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Frame } from "@/components/frame";
import { hasLocale, localeTag, routing } from "@/i18n/routing";
import "../globals.css";
import "temml/dist/Temml-Local.css";

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

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

/**
 * The served locales — one static layout shell per locale. The pages under
 * this layout are `force-dynamic` and resolve their data at request time.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(locale) ? locale : routing.defaultLocale,
    namespace: "app",
  });
  return {
    title: t("title"),
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
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={localeTag(locale)}
      className={`${geist.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
      </head>
      <body className="h-dvh overflow-hidden">
        <NextIntlClientProvider locale={locale} messages={await getMessages()}>
          <Frame>{children}</Frame>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
