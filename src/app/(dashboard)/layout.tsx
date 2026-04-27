import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside aria-label="Main navigation" className="w-56 shrink-0 border-r border-zinc-200 bg-zinc-50">
        <nav className="flex flex-col gap-1 p-4">
          <Link
            href="/leads"
            aria-current="page"
            className="block rounded-md border-l-2 border-blue-600 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"
          >
            Leads
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto px-8 py-12">{children}</main>
    </div>
  );
}
