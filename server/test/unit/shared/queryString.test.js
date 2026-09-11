/**
 * Unit tests for src/utils/queryString.js
 *
 * Pure, dependency-free helper - no mocking needed.
 */

const generateQueryString = require("../../../src/utils/queryString");

describe("generateQueryString (src/utils/queryString)", () => {
  it("should build a query string from simple key-value pairs", () => {
    expect(generateQueryString({ page: 1, limit: 10 })).toBe("page=1&limit=10");
  });

  it("should omit keys with null or undefined values", () => {
    expect(
      generateQueryString({ page: 1, status: null, search: undefined }),
    ).toBe("page=1");
  });

  it("should URL-encode keys and values", () => {
    expect(generateQueryString({ search: "hello world&stuff" })).toBe(
      "search=hello%20world%26stuff",
    );
  });

  it("should return an empty string for an empty object", () => {
    expect(generateQueryString({})).toBe("");
  });
});
