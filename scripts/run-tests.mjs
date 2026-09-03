/**
 * Discover and run all `*.test.ts` files under src/ (platform-independent).
 * Integration suites self-skip without TEST_DATABASE_URL / disposable DB guards.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".test.ts")) out.push(p);
  }
}

const files = [];
walk(join(process.cwd(), "src"), files);
files.sort();
if (files.length === 0) {
  console.error("No *.test.ts files found under src/");
  process.exit(1);
}

const r = spawnSync("npx", ["tsx", "--test", ...files], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(r.status ?? 1);
