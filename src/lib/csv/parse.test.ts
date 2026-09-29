import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords } from "./parse";

describe("parseCsv", () => {
  it("splits simple rows on commas and newlines", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('name,note\n"Acme, Inc.",hello')).toEqual([
      ["name", "note"],
      ["Acme, Inc.", "hello"],
    ]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(parseCsv('note\n"She said ""hi"""')).toEqual([["note"], ['She said "hi"']]);
  });

  it("keeps newlines inside a quoted field as one row", () => {
    expect(parseCsv('note\n"line one\nline two",done')).toEqual([
      ["note"],
      ["line one\nline two", "done"],
    ]);
  });

  it("ignores trailing blank lines", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsvRecords", () => {
  it("maps rows onto lower-cased header keys", () => {
    expect(parseCsvRecords("Company,Email\nAcme,hi@acme.com")).toEqual([
      { company: "Acme", email: "hi@acme.com" },
    ]);
  });

  it("returns an empty array for an empty file", () => {
    expect(parseCsvRecords("")).toEqual([]);
  });

  it("fills missing trailing columns with an empty string", () => {
    expect(parseCsvRecords("a,b,c\n1,2")).toEqual([{ a: "1", b: "2", c: "" }]);
  });
});
