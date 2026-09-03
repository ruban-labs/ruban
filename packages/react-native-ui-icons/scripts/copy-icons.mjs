import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const source = path.join(packageRoot, "src", "icons");

for (const target of ["commonjs", "module"]) {
  fs.cpSync(source, path.join(packageRoot, "lib", target, "icons"), {
    recursive: true,
  });
}
