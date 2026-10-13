const storageServices = require("../lib/storage");

/**
 * Removes an uploaded file when the request fails after Multer stored it.
 *
 * Error-handling middleware: place it after the controller of any route that
 * uses Multer, so failed validation never leaves orphan files behind.
 *
 * @param {Error} err - Error raised by a previous handler
 * @param {import("express").Request} req - Express request object
 * @param {import("express").Response} _res - Express response object
 * @param {Function} next - Express middleware callback
 *
 * @returns {Promise<void>} Passes the original error on
 */
const uploadCleanup = async (err, req, _res, next) => {
  await storageServices.removeUploadedFile(req.file);

  return next(err);
};

module.exports = uploadCleanup;
