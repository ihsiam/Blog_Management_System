const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

const generateHash = async (plainText) =>
  await bcrypt.hash(plainText, SALT_ROUNDS);

const compareHash = async (plainText, hashedText) =>
  await bcrypt.compare(plainText, hashedText);

module.exports = { generateHash, compareHash };
