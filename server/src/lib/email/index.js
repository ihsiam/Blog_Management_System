const nodemailer = require("nodemailer");

// Create and configure the email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send an email to a recipient
 *
 * @param {Object} params
 * @param {string} params.email - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.text - Plain text email content
 */
const sendMail = async ({ email, subject, text }) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      text,
    });

    console.log(`Email sent successfully: ${info.messageId}`);
  } catch (err) {
    console.error("Failed to send email:", err.message);
    throw new Error("Failed to send email");
  }
};

module.exports = { sendMail };
