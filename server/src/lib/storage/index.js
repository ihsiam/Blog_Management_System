const path = require("path");
const { serverError } = require("../../utils/error");

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

  return `/uploads/articles/${storedName}`;
};

module.exports = { uploadArticleCover, sanitizeFilename };
