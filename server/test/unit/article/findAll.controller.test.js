/**
 * Unit tests for src/api/v1/article/controllers/findAll.js
 *
 * Dependencies mocked:
 * - src/lib/articles (findAll, count)
 *
 * src/utils (query helpers) are left real: they are pure, deterministic,
 * dependency-free helpers, and exercising them confirms the controller
 * assembles the final response correctly.
 */

const mockFindAll = jest.fn();
const mockCount = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({
  findAll: mockFindAll,
  count: mockCount,
}));

const findAllController = require("../../../src/api/v1/article/controllers/findAll");
const { createMockResponse } = require("../helpers/mockExpress");

describe("article findAll controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockFindAll.mockReset();
    mockCount.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const buildRequest = (query = {}) => ({
    query,
    url: "/api/v1/articles",
    path: "/api/v1/articles",
  });

  describe("input validation", () => {
    it("should reject an invalid page number", async () => {
      const req = buildRequest({ page: "0" });

      await findAllController(req, res, next);

      expect(mockFindAll).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "page" })]),
      );
    });

    it("should reject an invalid limit", async () => {
      const req = buildRequest({ limit: "-1" });

      await findAllController(req, res, next);

      expect(mockFindAll).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "limit" })]),
      );
    });

    it("should reject an invalid sortType", async () => {
      const req = buildRequest({ sortType: "sideways" });

      await findAllController(req, res, next);

      expect(mockFindAll).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "sort_type" }),
        ]),
      );
    });

    it("should reject an invalid sortBy field", async () => {
      const req = buildRequest({ sortBy: "notAField" });

      await findAllController(req, res, next);

      expect(mockFindAll).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "sort_by" })]),
      );
    });
  });

  describe("successful retrieval", () => {
    it("should always request only published articles, regardless of query", async () => {
      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const req = buildRequest({ status: "draft" });
      await findAllController(req, res, next);

      expect(mockFindAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published" }),
      );
      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published" }),
      );
    });

    it("should return transformed articles with pagination and HATEOAS links", async () => {
      mockFindAll.mockResolvedValue([
        {
          id: "1",
          title: "Hello",
          cover: "cover.png",
          author: "user-1",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
          status: "published",
        },
      ]);
      mockCount.mockResolvedValue(11);

      const req = buildRequest({ page: "1", limit: "10" });
      await findAllController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.data).toEqual([
        {
          id: "1",
          title: "Hello",
          cover: "cover.png",
          author: "user-1",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
          link: "/api/v1/articles/1",
        },
      ]);
      expect(payload.data[0].status).toBeUndefined();
      expect(payload.pagination).toMatchObject({
        page: 1,
        limit: 10,
        totalItems: 11,
        totalPage: 2,
        next: 2,
      });
      expect(payload.links.self).toBe("/api/v1/articles");
      expect(next).not.toHaveBeenCalled();
    });

    it("should return an empty list when there are no matching articles", async () => {
      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const req = buildRequest();
      await findAllController(req, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.data).toEqual([]);
      expect(payload.pagination.next).toBeUndefined();
      expect(payload.pagination.prev).toBeUndefined();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when fetching articles fails", async () => {
      const dbError = new Error("db down");
      mockFindAll.mockRejectedValue(dbError);

      const req = buildRequest();
      await findAllController(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });

    it("should propagate the error when counting articles fails", async () => {
      mockFindAll.mockResolvedValue([]);
      const dbError = new Error("db down");
      mockCount.mockRejectedValue(dbError);

      const req = buildRequest();
      await findAllController(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
