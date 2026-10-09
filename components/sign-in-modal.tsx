"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignInForm } from "@/components/sign-in-form";
import { notifySignedIn, onRequestSignIn } from "@/lib/auth-events";

/**
 * The sign-in modal (#147): opens over whatever surface the person is on —
 * when any auth-gated call answers 401 (the API client asks for it), or when
 * they click Sign in in the top bar. A successful sign-in closes it in
 * place — no navigation — and announces it so the current surface can
 * refetch. Mounted once in the app frame.
 */
export function SignInModal() {
  const t = useTranslations("auth");
  const [open, setOpen] = useState(false);

  useEffect(() => onRequestSignIn(() => setOpen(true)), []);

  /** Success: close in place and let the current surface refetch (#147). */
  function handleSignedIn() {
    setOpen(false);
    notifySignedIn();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("tabSignIn")}</DialogTitle>
          <DialogDescription>{t("signInDescription")}</DialogDescription>
        </DialogHeader>
        <SignInForm onSuccess={handleSignedIn} />
      </DialogContent>
    </Dialog>
  );
}
