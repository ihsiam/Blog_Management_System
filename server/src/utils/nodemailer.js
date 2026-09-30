const nodemailer = require("nodemailer");

/**
 * Builds the SMTP transporter used for system emails.
 *
 * @returns {import("nodemailer").Transporter} Configured Nodemailer transporter
 */
const createTransporter = () => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASSWORD } = process.env;

  if (!EMAIL_SERVICE || !EMAIL_USER || !EMAIL_PASSWORD) {
    throw new Error("SMTP configuration is incomplete");
  }

  return nodemailer.createTransport({
    service: EMAIL_SERVICE,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
  });
};

module.exports = { createTransporter };
