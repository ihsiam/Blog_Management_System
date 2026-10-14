const fs = require("fs");
const path = require("path");
const { serverError } = require("../../utils/error");
const logger = require("../../utils/logger");

const COVER_URL_PREFIX = "/uploads/articles/";
const COVER_DIR = path.resolve(__dirname, "../../../uploads/articles");

/**
 * Stores an Article cover image locally for the current development setup.
 *
 * @param {Object} file - Validated Multer file
 * @returns {Promise<string>} Public local URL for the uploaded cover
 */
const uploadArticleCover = async (file) => {
  if (!file || !file.filename) {
    throw serverError("Article cover file is required");
  }

  // Multer already sanitized the name when it stored the file
  return `${COVER_URL_PREFIX}${file.filename}`;
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
  removeArticleCover,
  removeUploadedFile,
};
