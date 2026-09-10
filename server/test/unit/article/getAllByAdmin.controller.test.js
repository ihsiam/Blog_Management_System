/**
 * Unit tests for src/api/v1/article/controllers/getAllByAdmin.js
 *
 * Dependencies mocked:
 * - src/lib/articles (findAll, count)
 */

const mockFindAll = jest.fn();
const mockCount = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({
  findAll: mockFindAll,
  count: mockCount,
}));

const getAllByAdminController = require("../../../src/api/v1/article/controllers/getAllByAdmin");
const { createMockResponse } = require("../helpers/mockExpress");

describe("article getAllByAdmin controller", () => {
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
    url: "/api/v1/articles/all",
    path: "/api/v1/articles/all",
  });

  describe("input validation", () => {
    it("should reject an invalid status filter", async () => {
      const req = buildRequest({ status: "archived" });

      await getAllByAdminController(req, res, next);

      expect(mockFindAll).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "status" })]),
      );
    });
  });

  describe("successful retrieval", () => {
    it("should fetch every status when no status filter is provided", async () => {
      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await getAllByAdminController(buildRequest(), res, next);

      expect(mockFindAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: null }),
      );
      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({ status: null }),
      );
    });

    it("should filter by the requested status and include status in the response data", async () => {
      mockFindAll.mockResolvedValue([
        {
          id: "1",
          title: "Draft article",
          cover: "",
          author: "user-1",
          status: "draft",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ]);
      mockCount.mockResolvedValue(1);

      const req = buildRequest({ status: "draft" });
      await getAllByAdminController(req, res, next);

      expect(mockFindAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: "draft" }),
      );
      const payload = res.json.mock.calls[0][0];
      expect(payload.data[0].status).toBe("draft");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when fetching articles fails", async () => {
      const dbError = new Error("db down");
      mockFindAll.mockRejectedValue(dbError);

      await getAllByAdminController(buildRequest(), res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
