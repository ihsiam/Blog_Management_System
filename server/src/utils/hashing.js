const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

// hash generation
const generateHash = async (plainText) =>
  await bcrypt.hash(plainText, SALT_ROUNDS);

// hash verification
const compareHash = async (plainText, hashedText) =>
  await bcrypt.compare(plainText, hashedText);

module.exports = { generateHash, compareHash };
