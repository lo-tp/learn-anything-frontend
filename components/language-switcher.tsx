"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The short, native label shown for each locale. A language's name is
 * conventionally rendered in that language itself (so the English UI shows
 * "中文", not "Chinese"), which is why this is a static map rather than a
 * translated message.
 */
const nativeNames: Record<string, string> = { en: "EN", zh: "中文" };

/**
 * Language switcher — a dropdown between the Settings and Help icons.
 *
 * The trigger shows the current language; clicking it opens a menu listing
 * every locale. Selecting one re-routes to the *same* page under that
 * locale's prefix (`/en/…` ⇄ `/zh/…`), keeping the current path intact. It
 * only changes the UI language — it does not touch any backend language.
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("topbar");
  const currentLabel = nativeNames[locale] ?? locale;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("chooseLanguage")}
          className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest"
        >
          <Globe className="size-4" />
          {currentLabel}
          <ChevronDown className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() => {
              if (l !== locale) router.push(pathname, { locale: l });
            }}
          >
            {l === locale && <Check aria-hidden className="size-4" />}
            {nativeNames[l] ?? l}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
