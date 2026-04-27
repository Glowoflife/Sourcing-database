"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "block rounded-md border-l-2 border-blue-600 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"
          : "block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      }
    >
      {children}
    </Link>
  );
}
