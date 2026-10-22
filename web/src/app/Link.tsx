import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { navigate } from "./router.ts";

/** An in-app link: a real `<a>`, so opening it in a new tab still works. */
export const Link = ({
  to,
  onClick,
  ...props
}: { readonly to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) => {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || event.button !== 0 || modified) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={follow} {...props} />;
};
