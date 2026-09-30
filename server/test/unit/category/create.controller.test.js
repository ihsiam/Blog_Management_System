/**
 * Unit tests for src/api/v1/category/controllers/create.js
 *
 * Dependencies mocked:
 * - src/lib/categories (create)
 */

const mockCreate = jest.fn();
jest.doMock("../../../src/lib/categories", () => ({
  create: mockCreate,
}));

const createController = require("../../../src/api/v1/category/controllers/create");
const { createMockResponse } = require("../helpers/mockExpress");

describe("category create controller", () => {
  let res;
  let next;

  const validBody = {
    name: "Technology",
    description: "Technology articles",
  };

  beforeEach(() => {
    mockCreate.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject when the name is missing", async () => {
      await createController({ body: {} }, res, next);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
    });

    it("should reject a non-string description", async () => {
      await createController(
        { body: { ...validBody, description: 123 } },
        res,
        next,
      );

      expect(mockCreate).not.toHaveBeenCalled();
      expect(next.mock.calls[0][0].data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "description" }),
        ]),
      );
    });
  });

  describe("successful creation", () => {
    it("should trim the name and return the created category", async () => {
      const category = { id: "1", ...validBody };
      mockCreate.mockResolvedValue(category);

      await createController(
        { body: { ...validBody, name: " Technology " } },
        res,
        next,
      );

      expect(mockCreate).toHaveBeenCalledWith(validBody);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        code: 201,
        message: "Category created",
        data: category,
        links: { self: "/api/v1/categories/1" },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should convert duplicate-name errors to a conflict", async () => {
      mockCreate.mockRejectedValue({ code: 11000 });

      await createController({ body: validBody }, res, next);

      expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should propagate other service errors", async () => {
      const serviceError = new Error("db down");
      mockCreate.mockRejectedValue(serviceError);

      await createController({ body: validBody }, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });
});
