const bcrypt = require("bcrypt");

// salt round for hashing data
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

// bcrypt hash generation for the given text
const generateHash = (plainText) => bcrypt.hash(plainText, SALT_ROUNDS);

// Compare plain and hashed password
const compareHash = (plainText, hashedText) =>
  bcrypt.compare(plainText, hashedText);

module.exports = { generateHash, compareHash };
