/**
 * Unit tests for the article branch of src/middleware/ownership.js
 */

const mockCheckOwner = jest.fn();

jest.doMock('../../../src/lib/articles', () => ({
  checkOwner: mockCheckOwner,
}));
jest.doMock('../../../src/lib/comments', () => ({ checkOwner: jest.fn() }));
jest.doMock('../../../src/lib/user', () => ({ checkOwner: jest.fn() }));

const ownership = require('../../../src/middleware/ownership');

describe('ownership middleware - article resource', () => {
  let next;

  beforeEach(() => {
    mockCheckOwner.mockReset();
    next = jest.fn();
  });

  const validArticleId = '507f1f77bcf86cd799439011';

  describe('common guard checks', () => {
    it('should reject when there is no authenticated user', async () => {
      const req = { params: { id: validArticleId } };

      await ownership('article')(req, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Authentication required',
        }),
      );
      expect(mockCheckOwner).not.toHaveBeenCalled();
    });

    it('should reject when the resource id is missing', async () => {
      const req = { user: { id: 'user-1' }, params: {} };

      await ownership('article')(req, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'Resource ID is required',
        }),
      );
      expect(mockCheckOwner).not.toHaveBeenCalled();
    });

    it('should reject when the resource id is not a valid ObjectId', async () => {
      const req = { user: { id: 'user-1' }, params: { id: 'not-an-id' } };

      await ownership('article')(req, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
      expect(mockCheckOwner).not.toHaveBeenCalled();
    });
  });

  describe('article ownership rules', () => {
    it('should allow the request when the user owns the article', async () => {
      mockCheckOwner.mockResolvedValue(true);

      const req = {
        user: { id: 'user-1', role: 'user' },
        params: { id: validArticleId },
      };

      await ownership('article')(req, {}, next);

      expect(mockCheckOwner).toHaveBeenCalledWith({
        resourceId: validArticleId,
        userId: 'user-1',
      });
      expect(next).toHaveBeenCalledWith();
    });

    it('should allow the request when the admin does not own the article and admin access is enabled', async () => {
      mockCheckOwner.mockResolvedValue(false);

      const req = {
        user: { id: 'admin-1', role: 'admin' },
        params: { id: validArticleId },
      };

      await ownership('article', { allowAdmin: true })(req, {}, next);

      expect(mockCheckOwner).toHaveBeenCalledWith({
        resourceId: validArticleId,
        userId: 'admin-1',
      });
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject a non-owner, non-admin user', async () => {
      mockCheckOwner.mockResolvedValue(false);

      const req = {
        user: { id: 'user-2', role: 'user' },
        params: { id: validArticleId },
      };

      await ownership('article')(req, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'You do not have permission to access this article',
        }),
      );
    });

    it('should propagate the error when the ownership lookup fails', async () => {
      const dbError = new Error('db down');
      mockCheckOwner.mockRejectedValue(dbError);

      const req = {
        user: { id: 'user-1', role: 'user' },
        params: { id: validArticleId },
      };

      await ownership('article')(req, {}, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
