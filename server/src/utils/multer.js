const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { badRequest } = require("./error");

/**
 * Absolute path of the folder where article cover images are stored.
 * @type {string}
 */
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads/articles");

/**
 * Maximum allowed file size in bytes (5 MB).
 * @type {number}
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Allowed file extensions, without the leading dot.
 * @type {Set<string>}
 */
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

/**
 * Allowed MIME types.
 * @type {Set<string>}
 */
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Make sure the upload folder exists before any upload happens.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Create a URL-friendly filename base from the original name, or `"cover"`.
 *
 * Characters other than letters, digits, underscores, and hyphens become
 * hyphens. Repeated hyphens are collapsed and leading or trailing hyphens are
 * removed. Falls back to `"cover"` when nothing is left.
 *
 * @param {string} originalName - Original uploaded file name.
 * @param {string} extension - File extension including the dot (for example `.png`).
 * @returns {string} Sanitized base name without extension.
 */
const sanitizeBaseName = (originalName, extension) => {
  const cleaned = path
    .basename(originalName, extension)
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return cleaned || "cover";
};

/** Multer disk storage: timestamped, sanitized names under `UPLOAD_DIR`. */
const storage = multer.diskStorage({
  /**
   * Send files to `UPLOAD_DIR`.
   *
   * @param {import("express").Request} _req - Express request.
   * @param {Express.Multer.File} _file - Uploaded file.
   * @param {Function} callback - Multer destination callback.
   */
  destination: (_req, _file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  /**
   * Build `{timestamp}-{sanitizedBase}{extension}` as the stored name.
   *
   * The extension is lowercased. The timestamp is `Date.now()` in milliseconds.
   *
   * @param {import("express").Request} _req - Express request.
   * @param {Express.Multer.File} file - Uploaded file.
   * @param {Function} callback - Multer filename callback.
   */
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const baseName = sanitizeBaseName(file.originalname, extension);

    callback(null, `${Date.now()}-${baseName}${extension}`);
  },
});

/**
 * Build the validation error for an invalid cover file type.
 *
 * @returns {Error} Bad request error.
 */
const invalidFileTypeError = () =>
  badRequest(
    [{ field: "cover", message: "invalid file type", in: "file" }],
    "invalid input",
  );

/**
 * Accept images whose extension and MIME type are both in the allowed lists.
 *
 * Rejects the file with a bad request error otherwise.
 *
 * @param {import("express").Request} _req - Express request.
 * @param {Express.Multer.File} file - Uploaded file.
 * @param {(error: Error | null, accept?: boolean) => void} callback - Multer filter callback.
 * @returns {void} Result of calling the Multer callback.
 */
const fileFilter = (_req, file, callback) => {
  // Remove the leading dot so the extension matches the allowed set.
  const extension = path.extname(file.originalname).slice(1).toLowerCase();

  const isValid =
    ALLOWED_EXTENSIONS.has(extension) && ALLOWED_MIME_TYPES.has(file.mimetype);

  if (!isValid) {
    return callback(invalidFileTypeError());
  }

  return callback(null, true);
};

/**
 * Configured Multer instance for uploading article cover images.
 *
 * @type {import("multer").Multer}
 */
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

module.exports = upload;
