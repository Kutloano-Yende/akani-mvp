import { describe, expect, it } from "vitest";
import { escapeLike } from "./like";

describe("escapeLike", () => {
  it("escapes % _ and backslash so input can't widen a match", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLike("Kagiso Steelworks")).toBe("Kagiso Steelworks");
  });
});
