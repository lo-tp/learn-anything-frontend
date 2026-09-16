import { forwardRef } from "react";

/**
 * Test stand-in for `next/link`: a plain anchor. next-intl's `Link`
 * (BaseLink) forwards `href`/`children`/`className`/`ref`, so the href
 * assertions in the tests keep working.
 */
const Link = forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>((props, ref) => <a ref={ref} {...props} />);
Link.displayName = "Link";

export default Link;
