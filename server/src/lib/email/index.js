const nodemailer = require("nodemailer");

/**
 * SMTP transporter instance.
 */
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Sends an email using SMTP transport.
 *
 * @param {Object} params - Email payload
 * @param {string} params.email - Recipient email address
 * @param {string} params.subject - Email subject line
 * @param {string} params.text - Plain text email body content
 *
 * @throws {Error} If required fields are missing or email delivery fails
 *
 * @returns {Promise<Object>} Nodemailer response object containing message metadata
 */
const sendMail = async ({ email, subject, text }) => {
  // Validate required fields before attempting SMTP communication
  if (!email || !subject || !text) {
    throw new Error("Missing required email fields (email, subject, text)");
  }

  try {
    // Send email through configured SMTP transport
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      text,
    });

    // for monitoring delivery success
    console.log("EMAIL SENT:", {
      to: email,
      subject,
      messageId: info.messageId,
    });

    return info;
  } catch (err) {
    // Log internal error details
    console.error("Failed to send email:", err);

    // Avoid leaking low-level SMTP errors to higher layers
    throw new Error(`Email sending failed: ${err.message}`);
  }
};

module.exports = { sendMail };
