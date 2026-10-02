"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { getMe, updateMe, logoutAuth } from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Account menu in the top bar: a circular avatar (display-name initial)
 * opens a dropdown with the display name, an edit-name dialog, and sign out.
 *
 * Client component — fetches the current user's profile on mount (#92).
 */
export function AccountMenu() {
  const t = useTranslations("account");
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // A transient failure leaves the menu hidden — deliberately tolerated
    // (#132 gap 5): every surface is sign-in-gated, so an authenticated
    // `getMe` failing is a rare blip, and a full refresh re-attempts it.
    getMe().then((user) => setDisplayName(user.display_name)).catch(() => {});
  }, []);

  if (!displayName) return null;

  const initial = displayName.charAt(0).toUpperCase();

  function openEditDialog() {
    setInputValue(displayName!);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    // A blank name can't reach here — the Save button is disabled while
    // the input is blank (`!inputValue.trim()` in `disabled`).
    const name = inputValue.trim();
    setSaving(true);
    setError(null);
    try {
      const user = await updateMe(name);
      setDisplayName(user.display_name);
      setDialogOpen(false);
    } catch {
      setError(t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    // A failed sign-out leaves the user signed in (no navigation) — the
    // least-harmful outcome; there is no toast surface to report it
    // (#132 gap 1).
    try {
      await logoutAuth();
      router.push("/login");
    } catch {
      /* stay signed in */
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={displayName}
            className="focus-ring flex size-8 items-center justify-center rounded-[3px] border border-outline-variant bg-surface-container-lowest font-mono text-sm font-bold text-primary shadow-[var(--shadow-sheet)]"
          >
            {initial}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openEditDialog}>
            {t("editName")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut}>
            {t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editName")}</DialogTitle>
            <DialogDescription>
              {t("namePlaceholder")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
            />
            {error && (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving || !inputValue.trim()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
