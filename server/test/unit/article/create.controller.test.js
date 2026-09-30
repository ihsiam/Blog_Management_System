/**
 * Unit tests for src/api/v1/article/controllers/create.js
 *
 * Dependencies mocked:
 * - src/lib/articles (create business logic)
 */

const mockCreate = jest.fn();
jest.doMock('../../../src/lib/articles', () => ({ create: mockCreate }));

const createController = require('../../../src/api/v1/article/controllers/create');
const { createMockResponse } = require('../helpers/mockExpress');

describe('article create controller', () => {
  let res;
  let next;

  const validCategory = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    mockCreate.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe('input validation', () => {
    it('should reject when title is missing', async () => {
      const req = {
        body: { body: 'content', category: validCategory },
        file: { originalname: 'cover.png' },
        user: { id: 'user-1' },
      };

      await createController(req, res, next);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, error: 'Bad request' }),
      );
    });

    it('should reject a blank body', async () => {
      const req = {
        body: { title: 'Hello', body: '   ', category: validCategory },
        file: { originalname: 'cover.png' },
        user: { id: 'user-1' },
      };

      await createController(req, res, next);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it('should reject when the uploaded cover is missing', async () => {
      const req = {
        body: { title: 'Hello', body: 'content', category: validCategory },
        user: { id: 'user-1' },
      };

      await createController(req, res, next);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe('successful creation', () => {
    it('should create an article authored by the authenticated user', async () => {
      const createdArticle = {
        id: '1',
        title: 'Hello',
        body: 'content',
        cover: 'cover.png',
        status: 'published',
        author: 'user-1',
      };
      mockCreate.mockResolvedValue(createdArticle);

      const req = {
        body: {
          title: 'Hello',
          body: 'content',
          category: validCategory,
        },
        file: { originalname: 'cover.png' },
        user: { id: 'user-1' },
      };

      await createController(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith({
        title: 'Hello',
        body: 'content',
        status: 'published',
        author: 'user-1',
        category: validCategory,
        file: req.file,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 201,
          data: createdArticle,
          links: { self: '/api/v1/articles/1' },
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('dependency failures', () => {
    it('should propagate the error when article creation fails', async () => {
      const dbError = new Error('db down');
      mockCreate.mockRejectedValue(dbError);

      const req = {
        body: { title: 'Hello', body: 'content', category: validCategory },
        file: { originalname: 'cover.png' },
        user: { id: 'user-1' },
      };

      await createController(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
