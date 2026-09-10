/**
 * Unit tests for src/api/v1/article/controllers/getArticleAuthor.js
 *
 * Dependencies mocked:
 * - src/lib/service registry (getArticleAuthor orchestration)
 */

const mockGetArticleAuthor = jest.fn();
jest.doMock("../../../src/lib/service registry", () => ({
  getArticleAuthor: mockGetArticleAuthor,
}));

const getArticleAuthorController = require("../../../src/api/v1/article/controllers/getArticleAuthor");
const { createMockResponse } = require("../helpers/mockExpress");

describe("article getArticleAuthor controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockGetArticleAuthor.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  it("should reject an invalid article id", async () => {
    const req = { params: { id: "not-an-id" } };

    await getArticleAuthorController(req, res, next);

    expect(mockGetArticleAuthor).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("should reject when the author no longer exists", async () => {
    mockGetArticleAuthor.mockResolvedValue(null);

    const req = { params: { id: validId } };
    await getArticleAuthorController(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: "author not found" }),
    );
  });

  it("should return only the sanitized author fields", async () => {
    mockGetArticleAuthor.mockResolvedValue({
      id: "user-1",
      name: "Jane",
      email: "jane@test.com",
      password: "should-not-leak",
      refreshToken: "should-not-leak",
    });

    const req = { params: { id: validId } };
    await getArticleAuthorController(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toEqual({
      id: "user-1",
      name: "Jane",
      email: "jane@test.com",
    });
    expect(payload.links).toEqual({
      self: `/api/v1/articles/${validId}/author`,
      article: `/api/v1/articles/${validId}`,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when the article does not exist", async () => {
    const notFoundError = Object.assign(new Error("Not found"), {
      statusCode: 404,
    });
    mockGetArticleAuthor.mockRejectedValue(notFoundError);

    const req = { params: { id: validId } };
    await getArticleAuthorController(req, res, next);

    expect(next).toHaveBeenCalledWith(notFoundError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
