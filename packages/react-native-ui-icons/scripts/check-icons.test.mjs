import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const iconsRoot = path.join(packageRoot, "src", "icons");
const expectedIcons = [
  "arrow-right-cc.svg",
  "back-cc.svg",
  "caret-down-cc.svg",
  "check-cc.svg",
  "close-cc.svg",
  "copy-cc.svg",
  "delete-cc.svg",
  "edit-cc.svg",
  "external-link-cc.svg",
  "eye-cc.svg",
  "eye-closed-cc.svg",
  "forward-cc.svg",
  "globe-cc.svg",
  "home-cc.svg",
  "info-cc.svg",
  "lock-cc.svg",
  "more-cc.svg",
  "plus-cc.svg",
  "qr-code-cc.svg",
  "receive-cc.svg",
  "refresh-cc.svg",
  "search-cc.svg",
  "send-cc.svg",
  "settings-cc.svg",
  "star-cc.svg",
  "swap-cc.svg",
  "tabs-cc.svg",
  "wallet-cc.svg",
].sort();

test("publishes the reviewed currentColor icon set", () => {
  const actualIcons = fs.readdirSync(iconsRoot).sort();
  assert.deepEqual(actualIcons, expectedIcons);

  for (const icon of actualIcons) {
    const source = fs.readFileSync(path.join(iconsRoot, icon), "utf8");
    assert.match(source, /<svg\b/);
    assert.match(source, /viewBox=/);
    assert.match(source, /currentColor/);
    assert.doesNotMatch(
      source,
      /(?:fill|stroke)=["'](?!none["']|currentColor["'])[^"']+["']/
    );
  }
});
