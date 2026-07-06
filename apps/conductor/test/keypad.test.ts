import { describe, expect, test } from "vitest";
import { appendDigit, eraseDigit, isComplete, CODE_LENGTH } from "../src/lib/keypad";

describe("keypad code entry", () => {
  test("appends digits up to the code length and no further", () => {
    let code = "";
    for (const d of ["1", "2", "3", "4", "5"]) code = appendDigit(code, d);
    expect(code).toBe("1234");
    expect(code).toHaveLength(CODE_LENGTH);
  });

  test("ignores anything that is not a single digit", () => {
    expect(appendDigit("12", "a")).toBe("12");
    expect(appendDigit("12", "10")).toBe("12");
    expect(appendDigit("12", "")).toBe("12");
  });

  test("erases the last digit and never underflows", () => {
    expect(eraseDigit("123")).toBe("12");
    expect(eraseDigit("")).toBe("");
  });

  test("is complete only at exactly four digits", () => {
    expect(isComplete("123")).toBe(false);
    expect(isComplete("1234")).toBe(true);
    expect(isComplete("12345")).toBe(false);
  });
});
