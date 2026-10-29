const storageServices = require("../lib/storage");

/**
 * Delete a Multer-stored file when a later handler fails, then forward the error.
 *
 * Place after the controller on routes that use Multer so failed requests
 * do not leave orphan files.
 *
 * This is an Express error-handling middleware, so it runs only when an error
 * has been passed to `next`. It always forwards the original error.
 *
 * @param {Error} err - Error from a previous handler.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} _res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after `next` has been called.
 */
const uploadCleanup = async (err, req, _res, next) => {
  await storageServices.removeUploadedFile(req.file);

  return next(err);
};

module.exports = uploadCleanup;
