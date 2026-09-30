/**
 * Unit tests for src/api/v1/article/controllers/updateItemPatch.js
 *
 * Dependencies mocked:
 * - src/lib/articles (updateItemPatch)
 */

const mockUpdateItemPatch = jest.fn();
jest.doMock('../../../src/lib/articles', () => ({
  updateItemPatch: mockUpdateItemPatch,
}));

const updateItemPatchController = require('../../../src/api/v1/article/controllers/updateItemPatch');
const { createMockResponse } = require('../helpers/mockExpress');

describe('article updateItemPatch controller', () => {
  let res;
  let next;

  const validId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    mockUpdateItemPatch.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe('input validation', () => {
    it('should reject an invalid article id', async () => {
      const req = {
        params: { id: 'not-an-id' },
        body: { title: 'New title' },
      };

      await updateItemPatchController(req, res, next);

      expect(mockUpdateItemPatch).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it('should reject a non-string title when provided', async () => {
      const req = {
        params: { id: validId },
        body: { title: 42 },
      };

      await updateItemPatchController(req, res, next);

      expect(mockUpdateItemPatch).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it('should reject a status field even when present in the update payload', async () => {
      const req = {
        params: { id: validId },
        body: { title: 'New title', status: 'draft' },
      };

      await updateItemPatchController(req, res, next);

      expect(mockUpdateItemPatch).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe('successful update', () => {
    it('should patch only the supported fields', async () => {
      mockUpdateItemPatch.mockResolvedValue({ id: validId, title: 'New title' });

      const req = {
        params: { id: validId },
        body: { title: 'New title', body: 'Updated body' },
      };

      await updateItemPatchController(req, res, next);

      expect(mockUpdateItemPatch).toHaveBeenCalledWith(validId, {
        title: 'New title',
        body: 'Updated body',
        category: undefined,
        file: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Successfully updated article data',
          data: { id: validId, title: 'New title' },
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('dependency failures', () => {
    it('should propagate the error when the article does not exist', async () => {
      const notFoundError = Object.assign(new Error('Not found'), {
        statusCode: 404,
      });
      mockUpdateItemPatch.mockRejectedValue(notFoundError);

      const req = {
        params: { id: validId },
        body: { title: 'New title' },
      };
      await updateItemPatchController(req, res, next);

      expect(next).toHaveBeenCalledWith(notFoundError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
