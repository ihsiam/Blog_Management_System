/**
 * Unit tests for src/api/v1/category/controllers/findAll.js
 *
 * Dependencies mocked:
 * - src/lib/categories (findAll, count)
 */

const mockFindAll = jest.fn();
const mockCount = jest.fn();
jest.doMock("../../../src/lib/categories", () => ({
  findAll: mockFindAll,
  count: mockCount,
}));

const findAllController = require("../../../src/api/v1/category/controllers/findAll");
const { createMockResponse } = require("../helpers/mockExpress");

describe("category findAll controller", () => {
  let res;
  let next;

  const buildRequest = (query = {}) => ({
    query,
    url: "/api/v1/categories",
    path: "/api/v1/categories",
  });

  beforeEach(() => {
    mockFindAll.mockReset();
    mockCount.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject an invalid page", async () => {
      await findAllController(buildRequest({ page: "0" }), res, next);

      expect(mockFindAll).not.toHaveBeenCalled();
      expect(next.mock.calls[0][0].data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "page" })]),
      );
    });

    it("should reject an invalid sort field", async () => {
      await findAllController(buildRequest({ sortBy: "status" }), res, next);

      expect(next.mock.calls[0][0].data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "sort_by" })]),
      );
    });
  });

  describe("successful retrieval", () => {
    it("should pass pagination, sorting, and search to the services", async () => {
      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findAllController(
        buildRequest({
          page: "2",
          limit: "5",
          sortType: "asc",
          sortBy: "name",
          search: "tech",
        }),
        res,
        next,
      );

      expect(mockFindAll).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        sortBy: "name",
        sortType: "asc",
        searchTerm: "tech",
      });
      expect(mockCount).toHaveBeenCalledWith({ searchTerm: "tech" });
    });

    it("should return selected category fields and pagination", async () => {
      mockFindAll.mockResolvedValue([
        {
          id: "1",
          name: "Technology",
          description: "Tech",
          status: "active",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-02",
          internal: "hidden",
        },
      ]);
      mockCount.mockResolvedValue(1);

      await findAllController(buildRequest(), res, next);

      const payload = res.json.mock.calls[0][0];
      expect(res.status).toHaveBeenCalledWith(200);
      expect(payload.data).toEqual([
        expect.objectContaining({
          id: "1",
          name: "Technology",
          link: "/api/v1/categories/1",
        }),
      ]);
      expect(payload.data[0].internal).toBeUndefined();
      expect(payload.pagination).toMatchObject({
        page: 1,
        limit: 10,
        totalItems: 1,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate a service error", async () => {
      const serviceError = new Error("db down");
      mockFindAll.mockRejectedValue(serviceError);

      await findAllController(buildRequest(), res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });
});
