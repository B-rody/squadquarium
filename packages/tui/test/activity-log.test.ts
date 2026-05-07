import { describe, expect, it } from "vitest";
import { ActivityLog } from "../src/activity-log.js";

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
});
