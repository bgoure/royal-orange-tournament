import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const venuesSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "venues.ts"), "utf8");

/** Extract a top-level `export async function name(...) { ... }` body by brace depth. */
function exportFunctionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `missing export async function ${name}`);
  const brace = source.indexOf("{", start);
  assert.ok(brace >= 0, `missing body for ${name}`);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(brace, i + 1);
    }
  }
  assert.fail(`unclosed body for ${name}`);
}

describe("venues action revalidation", () => {
  for (const name of ["createVenue", "updateVenue", "deleteVenue", "moveVenue"] as const) {
    it(`${name} revalidates /admin/fields after success`, () => {
      const body = exportFunctionBody(venuesSource, name);
      assert.match(body, /revalidatePath\("\/admin\/fields"\)/);
    });
  }

  it("setLocationAsHeadquarters still revalidates /admin/fields", () => {
    const body = exportFunctionBody(venuesSource, "setLocationAsHeadquarters");
    assert.match(body, /revalidatePath\("\/admin\/fields"\)/);
  });
});
