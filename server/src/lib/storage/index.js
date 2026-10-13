const fs = require("fs");
const path = require("path");
const { serverError } = require("../../utils/error");
const logger = require("../../utils/logger");

const COVER_URL_PREFIX = "/uploads/articles/";
const COVER_DIR = path.resolve(__dirname, "../../../uploads/articles");

/**
 * Sanitizes an uploaded filename before local storage.
 *
 * @param {string} filename - Original uploaded filename
 * @returns {string} Sanitized filename
 */
const sanitizeFilename = (filename) => {
  const extension = path.extname(filename || "cover").toLowerCase();
  const basename = path
    .basename(filename || "cover", extension)
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${basename || "cover"}${extension}`;
};

/**
 * Stores an Article cover image locally for the current development setup.
 *
 * @param {Object} file - Validated Multer file
 * @returns {Promise<string>} Public local URL for the uploaded cover
 */
const uploadArticleCover = async (file) => {
  if (!file) {
    throw serverError("Article cover file is required");
  }

  const filename = sanitizeFilename(
    file.originalname || file.filename || "cover",
  );
  const storedName = file.filename || filename;

  return `${COVER_URL_PREFIX}${storedName}`;
};

/**
 * Removes a stored Article cover image.
 *
 * Best effort: a missing file is ignored and other failures are logged, so a
 * cleanup problem never fails the request that triggered it.
 *
 * @param {string} url - Cover URL returned by `uploadArticleCover`
 * @returns {Promise<void>}
 */
const removeArticleCover = async (url) => {
  if (typeof url !== "string" || !url.startsWith(COVER_URL_PREFIX)) {
    return;
  }

  // basename blocks path traversal through a tampered URL
  const filePath = path.join(COVER_DIR, path.basename(url));

  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      logger.error("Cover removal error", { url, message: err.message });
    }
  }
};

/**
 * Removes a file that was stored by Multer for a request that failed.
 *
 * @param {Object} file - Multer file
 * @returns {Promise<void>}
 */
const removeUploadedFile = async (file) => {
  if (!file || !file.filename) {
    return;
  }

  await removeArticleCover(`${COVER_URL_PREFIX}${file.filename}`);
};

module.exports = {
  uploadArticleCover,
  sanitizeFilename,
  removeArticleCover,
  removeUploadedFile,
};
