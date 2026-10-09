"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { updateMe, logoutAuth } from "@/lib/api-client";
import { notifySignedOut } from "@/lib/auth-events";
import { setSignInUser, useSignInState } from "@/hooks/use-sign-in-state";
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

/** Explore — the site root — the same href the top bar's Explore tab uses. */
const EXPLORE_PATH = "/";

/**
 * Account menu in the top bar: a circular avatar (display-name initial)
 * opens a dropdown with the display name, an edit-name dialog, and sign out.
 *
 * Client component. It does not probe identity itself: it prints the User
 * from the page's one sign-in state (`useSignInState`, #143) and hides
 * itself while that state holds no User — which is every Visitor's case, and
 * a probe the backend could not answer (a transient `/me` failure) is treated
 * the same way rather than breaking the shell (#132 gap 5). An edited name
 * is written back into that state, so the avatar and the rest of the chrome
 * stay in step.
 *
 * Signing out hands the person the Visitor's entry point: the public Explore
 * list at the site root (see `handleSignOut`).
 */
export function AccountMenu() {
  const t = useTranslations("account");
  const { user } = useSignInState();
  const router = useRouter();
  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // No profile in the state: a Visitor, or a probe the backend could not
  // answer. Either way there is nothing to print, and the menu hides.
  if (!user) return null;

  const displayName = user.display_name;
  const initial = displayName.charAt(0).toUpperCase();

  function openEditDialog() {
    setInputValue(displayName);
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
      const updated = await updateMe(name);
      setSignInUser(updated);
      setDialogOpen(false);
    } catch {
      setError(t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    // A failed sign-out leaves the user signed in and where they are — the
    // least-harmful outcome; there is no toast surface to report it
    // (#132 gap 1).
    try {
      await logoutAuth();
    } catch {
      return;
    }
    // Ask for the new page first: the sign-out announcement settles the
    // sign-in state to a Visitor's, which unmounts this menu (the top bar
    // becomes the Visitor chrome, #143), and a menu that is gone cannot
    // navigate. The chrome reads as a Visitor's as the route changes.
    // `replace`, not `push`: the signed-in surface they can no longer open
    // is not left in history behind them. No-op at the root, where the
    // Visitor's feed is already on screen.
    if (pathname !== EXPLORE_PATH) router.replace(EXPLORE_PATH);
    notifySignedOut();
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
