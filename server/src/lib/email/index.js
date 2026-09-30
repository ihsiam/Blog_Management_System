const { createTransporter } = require("../../utils/nodemailer");

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }

  return transporter;
};

/**
 * Sends an email via the configured SMTP transporter.
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

    console.log("EMAIL SENT:", {
      to: email,
      subject,
      messageId: info.messageId,
    });

    return info;
  } catch (err) {
    console.error("Failed to send email:", err);
    throw new Error(`Email sending failed: ${err.message}`);
  }
};

module.exports = { sendMail };
