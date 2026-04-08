import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata: Metadata = {
  title: { default: "Admin · Tournament Hub", template: "%s · Admin · Tournament Hub" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full bg-zinc-100">
      <AdminSidebar />
      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <main className="flex-1 bg-white">
          <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
