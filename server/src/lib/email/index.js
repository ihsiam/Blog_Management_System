const nodemailer = require("nodemailer");

/**
 * SMTP transporter instance used for sending emails.
 */
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Sends an email via configured SMTP transporter.
 *
 * @param {Object} params - Email payload
 * @param {string} params.email - Recipient email address
 * @param {string} params.subject - Email subject line
 * @param {string} params.text - Plain text email body
 *
 * @returns {Promise<Object>} Nodemailer response containing message metadata
 *
 * @throws {Error} If required fields are missing
 * @throws {Error} If SMTP delivery fails
 */
const sendMail = async ({ email, subject, text }) => {
  /**
   * Validate required fields before SMTP request
   */
  if (!email || !subject || !text) {
    throw new Error("Missing required email fields (email, subject, text)");
  }

  try {
    /**
     * Send email via SMTP transport
     */
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      text,
    });

    /**
     * Delivery log (for debugging + monitoring)
     */
    console.log("EMAIL SENT:", {
      to: email,
      subject,
      messageId: info.messageId,
    });

    return info;
  } catch (err) {
    /**
     * Internal error logging (do not expose SMTP internals upward)
     */
    console.error("Failed to send email:", err);

    throw new Error(`Email sending failed: ${err.message}`);
  }
};

module.exports = { sendMail };
