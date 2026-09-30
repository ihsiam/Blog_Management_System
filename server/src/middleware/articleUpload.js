const path = require("path");
const { badRequest } = require("../utils/error");

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Validates an uploaded Article cover image.
 *
 * This middleware is intentionally narrow: it checks the already-uploaded file
 * and passes control to the controller layer. The actual Multer setup remains in
 * src/utils/multer.js.
 *
 * @param {import("express").Request} req - Express request object
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express middleware callback
 *
 * @returns {void} Passes control after upload validation
 */
const articleUpload = (req, _res, next) => {
  const file = req.file || req.files?.[0];

  if (!file) {
    return next();
  }

  if (file.size > MAX_FILE_SIZE) {
    return next(
      badRequest(
        [{ field: "cover", message: "file is too large", in: "file" }],
        "invalid input",
      ),
    );
  }

  const extension = path.extname(file.originalname).slice(1).toLowerCase();

  if (
    !ALLOWED_EXTENSIONS.has(extension) ||
    !ALLOWED_MIME_TYPES.has(file.mimetype)
  ) {
    return next(
      badRequest(
        [{ field: "cover", message: "invalid file type", in: "file" }],
        "invalid input",
      ),
    );
  }

  if (file.originalname) {
    const sanitizedName = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    file.originalname = `${sanitizedName || "cover"}${path.extname(file.originalname).toLowerCase()}`;
  }

  return next();
};

module.exports = articleUpload;
