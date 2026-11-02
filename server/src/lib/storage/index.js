const { Readable } = require("stream");
const cloudinary = require("../../config/cloudinary");
const { serverError } = require("../../utils/error");
const logger = require("../../utils/logger");

const CLOUDINARY_FOLDER = "blog-management/articles";

/**
 * Upload a memory-storage buffer through Cloudinary's upload stream API.
 *
 * @param {Buffer} buffer - Image contents captured by Multer.
 * @returns {Promise<Object>} Cloudinary upload result.
 */
const uploadBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: CLOUDINARY_FOLDER, resource_type: "image" },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    Readable.from(buffer).pipe(stream);
  });

/**
 * Extract a Cloudinary public ID from a secure delivery URL.
 *
 * @param {string} url - Stored Cloudinary secure URL.
 * @returns {string|null} Public ID, or null for a non-Cloudinary URL.
 */
const getPublicId = (url) => {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("cloudinary.com")) return null;

    const parts = parsed.pathname.split("/").filter(Boolean);
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex < 0) return null;

    const publicIdParts = parts.slice(uploadIndex + 1);
    if (publicIdParts[0]?.startsWith("v")) publicIdParts.shift();
    if (!publicIdParts.length) return null;

    const last = publicIdParts.length - 1;
    publicIdParts[last] = publicIdParts[last].replace(/\.[^.]+$/, "");
    return publicIdParts.join("/");
  } catch (_err) {
    return null;
  }
};

/**
 * Upload an article cover image to Cloudinary.
 *
 * @param {Object} file - Validated Multer memory-storage file.
 * @returns {Promise<string>} Cloudinary secure URL.
 * @throws {Error} When the file is missing or Cloudinary returns no URL.
 */
const uploadArticleCover = async (file) => {
  if (!file || !file.buffer) {
    throw serverError("Article cover file is required");
  }

  const result = await uploadBuffer(file.buffer);
  if (!result?.secure_url) {
    throw serverError("Article cover upload failed");
  }

  return result.secure_url;
};

/**
 * Remove a Cloudinary article cover using its stored URL.
 *
 * Non-Cloudinary URLs are ignored because the application manages only
 * Cloudinary assets.
 *
 * @param {string} url - Stored article cover URL.
 * @returns {Promise<void>} Resolves after deletion or an ignored URL.
 */
const removeArticleCover = async (url) => {
  const publicId = typeof url === "string" ? getPublicId(url) : null;
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    logger.error("Cover removal error", { url, message: err.message });
  }
};

module.exports = {
  uploadArticleCover,
  removeArticleCover,
};
