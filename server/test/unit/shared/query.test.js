/**
 * Unit tests for src/utils/query.js
 *
 * Pure, dependency-free helpers - no mocking needed. These functions
 * have already been exercised indirectly (through real, unmocked use)
 * by every Article/Comment/User controller test in prior phases; this
 * file directly verifies their own branches/edge cases in isolation.
 */

const {
  getPagination,
  transformData,
  hateOAS,
} = require("../../../src/utils/query");

describe("query utilities (src/utils/query)", () => {
  describe("getPagination", () => {
    it("should include both next and prev when on a middle page", () => {
      const pagination = getPagination(2, 10, 30);

      expect(pagination).toEqual({
        page: 2,
        limit: 10,
        totalItems: 30,
        totalPage: 3,
        next: 3,
        prev: 1,
      });
    });

    it("should omit prev on the first page", () => {
      const pagination = getPagination(1, 10, 30);

      expect(pagination.prev).toBeUndefined();
      expect(pagination.next).toBe(2);
    });

    it("should omit next on the last page", () => {
      const pagination = getPagination(3, 10, 30);

      expect(pagination.next).toBeUndefined();
      expect(pagination.prev).toBe(2);
    });

    it("should omit both next and prev when there is only one page", () => {
      const pagination = getPagination(1, 10, 5);

      expect(pagination.next).toBeUndefined();
      expect(pagination.prev).toBeUndefined();
      expect(pagination.totalPage).toBe(1);
    });

    it("should handle zero total items", () => {
      const pagination = getPagination(1, 10, 0);

      expect(pagination.totalPage).toBe(0);
      expect(pagination.next).toBeUndefined();
      expect(pagination.prev).toBeUndefined();
    });

    it("should use system defaults when called with no arguments", () => {
      const pagination = getPagination();

      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(10);
      expect(pagination.totalItems).toBe(0);
    });
  });

  describe("transformData", () => {
    it("should pick only the selected fields and attach a resource link", () => {
      const result = transformData({
        items: [{ id: "1", title: "Hello", secret: "hide-me" }],
        selection: ["id", "title"],
        path: "/api/v1/articles",
      });

      expect(result).toEqual([
        { id: "1", title: "Hello", link: "/api/v1/articles/1" },
      ]);
    });

    it("should return full items with a link when no selection is provided", () => {
      const result = transformData({
        items: [{ id: "1", title: "Hello" }],
        path: "/api/v1/articles",
      });

      expect(result).toEqual([
        { id: "1", title: "Hello", link: "/api/v1/articles/1" },
      ]);
    });

    it("should not attach a link when no path is provided", () => {
      const result = transformData({
        items: [{ id: "1", title: "Hello" }],
        selection: ["id", "title"],
      });

      expect(result).toEqual([{ id: "1", title: "Hello" }]);
    });

    it("should return an empty array for an empty item list", () => {
      expect(transformData({ items: [], selection: ["id"] })).toEqual([]);
    });

    it("should throw when items is not an array", () => {
      expect(() => transformData({ items: "not-an-array" })).toThrow(
        "Invalid arguments",
      );
    });

    it("should throw when selection is not an array", () => {
      expect(() =>
        transformData({ items: [], selection: "not-an-array" }),
      ).toThrow("Invalid arguments");
    });
  });

  describe("hateOAS", () => {
    it("should always include a self link", () => {
      const links = hateOAS({ url: "/api/v1/articles" });

      expect(links.self).toBe("/api/v1/articles");
      expect(links.next).toBeUndefined();
      expect(links.prev).toBeUndefined();
    });

    it("should build a next link with the incremented page and original query", () => {
      const links = hateOAS({
        path: "/api/v1/articles",
        query: { limit: "10" },
        hasNext: true,
        page: 1,
      });

      expect(links.next).toBe("/api/v1/articles?limit=10&page=2");
    });

    it("should build a prev link with the decremented page", () => {
      const links = hateOAS({
        path: "/api/v1/articles",
        query: { limit: "10" },
        hasPrev: true,
        page: 2,
      });

      expect(links.prev).toBe("/api/v1/articles?limit=10&page=1");
    });

    it("should build both next and prev links when both flags are set", () => {
      const links = hateOAS({
        path: "/api/v1/articles",
        query: {},
        hasNext: true,
        hasPrev: true,
        page: 2,
      });

      expect(links.next).toBe("/api/v1/articles?page=3");
      expect(links.prev).toBe("/api/v1/articles?page=1");
    });
  });
});
