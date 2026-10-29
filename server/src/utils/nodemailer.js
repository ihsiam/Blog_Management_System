const nodemailer = require("nodemailer");

/**
 * Build the SMTP transporter used for system emails.
 *
 * Reads the `EMAIL_SERVICE`, `EMAIL_USER`, and `EMAIL_PASSWORD` environment
 * variables. A new transporter is created on every call.
 *
 * @returns {import("nodemailer").Transporter} Configured Nodemailer transporter.
 * @throws {Error} When EMAIL_SERVICE, EMAIL_USER, or EMAIL_PASSWORD is missing.
 */
const createTransporter = () => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASSWORD } = process.env;

  // Fail early with a clear message instead of failing later when sending.
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
