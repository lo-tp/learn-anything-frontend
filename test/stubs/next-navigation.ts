/**
 * Test stand-in for `next/navigation`: Next's router hooks are unavailable
 * in jsdom. next-intl's client navigation only pulls `useRouter`,
 * `usePathname`, `redirect`, and `permanentRedirect` from here, so inert
 * implementations suffice.
 */
export function useRouter() {
  return {
    push() {},
    replace() {},
    back() {},
    forward() {},
    prefetch() {},
  };
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function redirect() {
  throw new Error("redirect() called in test");
}

export function permanentRedirect() {
  throw new Error("permanentRedirect() called in test");
}
