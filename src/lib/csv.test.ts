import { describe, expect, it } from "vitest";
import { csvResponse, toCsv } from "./csv";

describe("toCsv", () => {
  it("joins rows with CRLF and a trailing newline", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("a,b\r\n1,x\r\n");
  });

  it("quotes cells containing commas, quotes or newlines, escaping quotes", () => {
    expect(toCsv(["h"], [['a,b'], ['say "hi"'], ["line1\nline2"]])).toBe(
      'h\r\n"a,b"\r\n"say ""hi"""\r\n"line1\nline2"\r\n',
    );
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,\r\n");
  });

  it.each(["=SUM(A1)", "+1", "-1+1", "@cmd", "\tx", "\rx"])(
    "neutralises spreadsheet formula text %j",
    (value) => {
      const csv = toCsv(["h"], [[value]]);
      expect(csv.split("\r\n")[1].replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("does not alter real negative numbers", () => {
    expect(toCsv(["h"], [[-5]])).toBe("h\r\n-5\r\n");
  });

  it("neutralises a formula that also needs quoting", () => {
    expect(toCsv(["h"], [['=HYPERLINK("x","y")']])).toBe('h\r\n"\'=HYPERLINK(""x"",""y"")"\r\n');
  });
});

describe("csvResponse", () => {
  it("sets download headers, a UTF-8 BOM and no-store caching", async () => {
    const res = csvResponse("a\r\n", "x.csv");
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="x.csv"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    // Check raw bytes: Response.text() strips a leading BOM by spec.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});
