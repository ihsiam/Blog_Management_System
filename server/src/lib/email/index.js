const { createTransporter } = require("../../utils/nodemailer");
const logger = require("../../utils/logger");

// Cached transporter, created lazily so the SMTP settings are read on first send.
let transporter;

/**
 * Return the shared SMTP transporter, creating it on first use.
 *
 * @returns {import("nodemailer").Transporter} Nodemailer transporter instance.
 * @throws {Error} When the SMTP configuration is incomplete.
 */
const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }

  return transporter;
};

/**
 * Send an email via the configured SMTP transporter.
 *
 * @param {Object} params - Email payload.
 * @param {string} params.email - Recipient email address.
 * @param {string} params.subject - Email subject line.
 * @param {string} params.text - Plain-text email body.
 * @returns {Promise<Object>} Nodemailer response containing message metadata.
 * @throws {Error} When required fields are missing.
 * @throws {Error} When SMTP delivery fails.
 */
const sendMail = async ({ email, subject, text }) => {
  if (!email || !subject || !text) {
    throw new Error("Missing required email fields (email, subject, text)");
  }

  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      text,
    });

    logger.info("Email sent", {
      subject,
      messageId: info.messageId,
    });

    return info;
  } catch (err) {
    logger.error("Failed to send email", { subject, message: err.message });
    // Wrap the error so callers see a consistent message prefix.
    throw new Error(`Email sending failed: ${err.message}`);
  }
};

module.exports = { sendMail };
