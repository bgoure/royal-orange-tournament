import Link from "next/link";

const links = [
  { href: "/locations", label: "Locations", description: "Venues & maps" },
  { href: "/faq", label: "FAQ", description: "Answers to common questions" },
  { href: "/settings", label: "Settings", description: "App preferences" },
  { href: "/social", label: "Social", description: "Follow Baseball Milton" },
] as const;

export default function MorePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">More</h1>
        <p className="text-sm text-zinc-600">Quick links and resources.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-[52px] flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-colors active:scale-[0.99] hover:border-royal-200"
            >
              <span className="font-semibold text-zinc-900">{item.label}</span>
              <span className="text-xs text-zinc-500">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
