import { OrganizationMemberRole, OrganizationPlan } from "@prisma/client";
import { prisma } from "@/lib/db";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function createOrganizationForUser(opts: {
  userId: string;
  name: string;
  plan?: OrganizationPlan;
}): Promise<{ id: string; slug: string }> {
  const base = slugify(opts.name) || "org";
  let slug = base;
  let n = 0;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  const org = await prisma.organization.create({
    data: {
      name: opts.name,
      slug,
      brandName: opts.name,
      plan: opts.plan ?? OrganizationPlan.FREE,
      maxTournaments: opts.plan === OrganizationPlan.PRO ? 50 : opts.plan === OrganizationPlan.STARTER ? 5 : 1,
      members: {
        create: {
          userId: opts.userId,
          role: OrganizationMemberRole.OWNER,
        },
      },
    },
  });
  return { id: org.id, slug: org.slug };
}

/** Enforce plan tournament caps before create. ADMIN global escape hatch skips. */
export async function assertCanCreateTournamentInOrg(opts: {
  organizationId: string | null | undefined;
  isGlobalAdmin: boolean;
}): Promise<string | null> {
  if (opts.isGlobalAdmin || !opts.organizationId) return null;
  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: {
      maxTournaments: true,
      plan: true,
      stripeSubscriptionId: true,
      _count: { select: { tournaments: { where: { archivedAt: null } } } },
    },
  });
  if (!org) return "Organization not found.";
  if (org._count.tournaments >= org.maxTournaments) {
    return `Plan ${org.plan} allows ${org.maxTournaments} live tournament(s). Upgrade billing or archive an event.`;
  }
  return null;
}

export async function getOrganizationBrandingForTournament(tournamentId: string) {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      name: true,
      pwaThemeColor: true,
      pwaIcon192Url: true,
      pwaIcon512Url: true,
      organization: {
        select: {
          brandName: true,
          name: true,
          primaryColor: true,
          accentColor: true,
          logoUrl: true,
          pwaThemeColor: true,
        },
      },
    },
  });
  if (!t) return null;
  const org = t.organization;
  return {
    name: org?.brandName || org?.name || t.name,
    themeColor: org?.pwaThemeColor || org?.primaryColor || t.pwaThemeColor || "#1a1a2e",
    icon192: org?.logoUrl || t.pwaIcon192Url || "/icon-192.png",
    icon512: org?.logoUrl || t.pwaIcon512Url || "/icon-512.png",
  };
}

/**
 * Stripe billing stub — wire STRIPE_SECRET_KEY later.
 * Returns checkout URL placeholder when Stripe is not configured.
 */
export async function createOrgBillingCheckoutStub(organizationId: string): Promise<{
  ok: boolean;
  url?: string;
  error?: string;
}> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      ok: false,
      error:
        "Stripe is not configured (set STRIPE_SECRET_KEY). Org plans still enforce maxTournaments locally.",
    };
  }
  // Placeholder until Stripe SDK is added as a dependency.
  return {
    ok: true,
    url: `/admin/organizations/${organizationId}/billing?stripe=pending`,
  };
}
