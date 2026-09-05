/**
 * Public bracket rendering must never write. `listBracketsForTournament` used to run the
 * OBA round-grouping repair on every call, including anonymous page loads.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// The service module constructs the Prisma client on import; no query is ever issued here.
process.env.DATABASE_URL ??= "postgresql://unused:unused@127.0.0.1:5432/unused";

const WRITE_METHODS = [
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "$transaction",
  "$executeRaw",
  "$executeRawUnsafe",
  "$queryRawUnsafe",
];

/** Prisma stand-in that records reads and throws on anything that could mutate. */
function makeReadOnlySpy() {
  const calls: string[] = [];
  const bracketDelegate = new Proxy(
    {
      findMany: async (args: unknown) => {
        calls.push("bracket.findMany");
        void args;
        return [];
      },
    },
    {
      get(target, prop: string) {
        if (prop in target) return target[prop as keyof typeof target];
        throw new Error(`unexpected prisma.bracket.${String(prop)} in a read path`);
      },
    },
  );
  const client = new Proxy(
    { bracket: bracketDelegate },
    {
      get(target, prop: string) {
        if (prop in target) return target[prop as keyof typeof target];
        throw new Error(`unexpected prisma.${String(prop)} in a read path`);
      },
    },
  );
  return { calls, client };
}

describe("listBracketsForTournament", () => {
  it("issues a single read and no writes with default options", async () => {
    const { listBracketsForTournament } = await import("./brackets");
    const { calls, client } = makeReadOnlySpy();

    await listBracketsForTournament("t1", undefined, client as never);

    assert.deepEqual(calls, ["bracket.findMany"]);
  });

  it("issues no writes on the published-only (public site) path", async () => {
    const { listBracketsForTournament } = await import("./brackets");
    const { calls, client } = makeReadOnlySpy();

    await listBracketsForTournament("t1", { publishedOnly: true }, client as never);

    assert.deepEqual(calls, ["bracket.findMany"]);
  });

  it("keeps sit-out rows on the public bracket tree for bye cards", async () => {
    const { listBracketsForTournament } = await import("./brackets");
    const seen: Record<string, unknown>[] = [];
    const client = {
      bracket: {
        findMany: async (args: Record<string, unknown>) => {
          seen.push(args);
          return [];
        },
      },
    };

    await listBracketsForTournament("t1", { publishedOnly: true }, client as never);

    const include = seen[0]?.include as { games?: { where?: unknown } };
    assert.equal(include?.games?.where, undefined, "sit-outs stay on the bracket tree");
  });

  it("filters to published brackets only when asked", async () => {
    const { listBracketsForTournament } = await import("./brackets");
    const seen: Record<string, unknown>[] = [];
    const client = {
      bracket: {
        findMany: async (args: Record<string, unknown>) => {
          seen.push(args);
          return [];
        },
      },
    };

    await listBracketsForTournament("t1", undefined, client as never);
    await listBracketsForTournament("t1", { publishedOnly: true }, client as never);

    assert.deepEqual(seen[0]?.where, { tournamentId: "t1" });
    assert.deepEqual(seen[1]?.where, { tournamentId: "t1", published: true });
  });
});

describe("brackets service source", () => {
  it("contains no repair or write calls", () => {
    const file = path.resolve(process.cwd(), "src/lib/services/brackets.ts");
    const source = fs.readFileSync(file, "utf8");

    assert.equal(
      /repairOba\w*\(/.test(source),
      false,
      "repair helpers must not be called from the read module",
    );
    for (const method of WRITE_METHODS) {
      assert.equal(
        source.includes(`.${method}(`),
        false,
        `${method} must not appear in the public bracket read module`,
      );
    }
  });
});
