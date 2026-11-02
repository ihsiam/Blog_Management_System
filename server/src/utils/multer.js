const path = require("path");
const multer = require("multer");
const { badRequest } = require("./error");

/** Maximum accepted image size in bytes (5 MB). */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** File extensions accepted for article covers. */
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

/** MIME types accepted for article covers. */
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Build the existing API error for an invalid cover type.
 *
 * @returns {Error} Bad-request upload error.
 */
const invalidFileTypeError = () =>
  badRequest(
    [{ field: "cover", message: "invalid file type", in: "file" }],
    "invalid input",
  );

/**
 * Accept only files whose extension and declared MIME type are allowed.
 *
 * @param {import("express").Request} _req - Express request.
 * @param {Express.Multer.File} file - Incoming file metadata.
 * @param {(error: Error|null, accept?: boolean) => void} callback - Multer callback.
 * @returns {void} Invokes the Multer callback.
 */
const fileFilter = (_req, file, callback) => {
  const extension = path.extname(file.originalname).slice(1).toLowerCase();
  const isValid =
    ALLOWED_EXTENSIONS.has(extension) && ALLOWED_MIME_TYPES.has(file.mimetype);

  if (!isValid) return callback(invalidFileTypeError());
  return callback(null, true);
};

/**
 * Multer instance that keeps the validated upload in memory for Cloudinary.
 *
 * @type {import("multer").Multer}
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

module.exports = upload;
