import assert from "node:assert/strict";
import test from "node:test";

import { analyzeUiDependencies } from "./analyze-ui-dependencies.mjs";

test("UI dependency graph captures the current package boundaries", () => {
  const report = analyzeUiDependencies();

  assert.deepEqual(report.cycles, []);
  assert.equal(
    report.internalEdges.some(
      (edge) => edge.from === "ui/Dialog" && edge.to === "ui/OverlayHost",
    ),
    true,
  );
  assert.equal(
    report.internalEdges.some(
      (edge) => edge.from === "ui/Textarea" && edge.to === "ui/Input",
    ),
    true,
  );
  assert.deepEqual(
    report.externalEdges.filter((edge) => edge.to === "react-native-safe-area-context"),
    [{ from: "ui/BottomSheetModal", to: "react-native-safe-area-context" }],
  );
});
