const fs = require("fs");
const path = require("path");
const { serverError } = require("../../utils/error");
const logger = require("../../utils/logger");

// URL prefix under which stored cover images are publicly served.
const COVER_URL_PREFIX = "/uploads/articles/";
// Absolute folder on disk where cover images are stored.
const COVER_DIR = path.resolve(__dirname, "../../../uploads/articles");

/**
 * Store an article cover image locally for the current development setup.
 *
 * @param {Object} file - Validated Multer file.
 * @returns {Promise<string>} Public local URL for the uploaded cover.
 * @throws {Error} When the file or its file name is missing.
 */
const uploadArticleCover = async (file) => {
  if (!file || !file.filename) {
    throw serverError("Article cover file is required");
  }

  // Multer already sanitized the name when it stored the file.
  return `${COVER_URL_PREFIX}${file.filename}`;
};

/**
 * Remove a stored article cover image.
 *
 * @param {string} url - Cover URL returned by `uploadArticleCover`.
 * @returns {Promise<void>} Resolves when the file is removed or skipped.
 */
const removeArticleCover = async (url) => {
  if (typeof url !== "string" || !url.startsWith(COVER_URL_PREFIX)) {
    return;
  }

  // basename blocks path traversal through a tampered URL.
  const filePath = path.join(COVER_DIR, path.basename(url));

  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    // A missing file is expected, so only other errors are logged.
    if (err.code !== "ENOENT") {
      logger.error("Cover removal error", { url, message: err.message });
    }
  }
};

/**
 * Remove a file that was stored by Multer for a request that failed.
 *
 * @param {Object} file - Multer file.
 * @returns {Promise<void>} Resolves when the file is removed or skipped.
 */
const removeUploadedFile = async (file) => {
  if (!file || !file.filename) {
    return;
  }

  await removeArticleCover(`${COVER_URL_PREFIX}${file.filename}`);
};

module.exports = {
  uploadArticleCover,
  removeArticleCover,
  removeUploadedFile,
};
