import { describe, expect, it } from "vitest";
import { ActivityLog } from "../src/activity-log.js";
import { createMockBuffer } from "./helpers/mock-screen-buffer.js";

describe("ActivityLog", () => {
  it("renders newest entries at the bottom", () => {
    const log = new ActivityLog(10);
    log.add("one", "10:00:00");
    log.add("two", "10:00:01");
    log.add("three", "10:00:02");

    expect(log.getVisibleLines(2)).toEqual(["[10:00:01] two", "[10:00:02] three"]);
  });

  it("scrolls upward with wheel input", () => {
    const log = new ActivityLog(10);
    for (let index = 0; index < 5; index += 1) {
      log.add(`entry-${index}`, `10:00:0${index}`);
    }

    log.handleWheel("up");
    expect(log.getScrollOffset()).toBe(1);
  });

  it("renders activity lines with color attrs", () => {
    const colors = {
      timestampColor: { r: 107, g: 140, b: 163 },
      color: { r: 244, g: 251, b: 255 },
      bgColor: { r: 0, g: 27, b: 46 },
    };
    const log = new ActivityLog(10);
    const buffer = createMockBuffer(40, 3);
    log.add("reef status nominal", "10:00:00");

    log.render(buffer, { x: 0, y: 0, width: 40, height: 3 }, colors);

    expect(buffer.putCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attr: { color: colors.timestampColor, bgColor: colors.bgColor },
          char: "[10:00:00] ",
        }),
        expect.objectContaining({
          attr: { color: colors.color, bgColor: colors.bgColor },
          char: "reef status nominal",
        }),
      ]),
    );
  });
});
