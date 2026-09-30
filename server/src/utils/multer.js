const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { badRequest } = require("./error");

const uploadDir = path.resolve(__dirname, "../../uploads/articles");

fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const basename = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    const safeName = `${basename || "cover"}${extension}`;
    callback(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).slice(1).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return callback(
        badRequest(
          [{ field: "cover", message: "invalid file type", in: "file" }],
          "invalid input",
        ),
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(
        badRequest(
          [{ field: "cover", message: "invalid file type", in: "file" }],
          "invalid input",
        ),
      );
    }

    return callback(null, true);
  },
});

module.exports = upload;
