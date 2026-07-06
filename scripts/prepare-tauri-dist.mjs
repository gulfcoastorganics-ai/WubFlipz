import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "tauri-dist");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const item of ["index.html", "css", "js"]) {
  await cp(resolve(root, item), resolve(out, item), { recursive: true });
}
