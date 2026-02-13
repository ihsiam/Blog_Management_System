const mongoose = require("mongoose");

// Connect to MongoDB using Mongoose.
const connectDB = async () => {
  const { DB_URL } = process.env;
  if (!DB_URL) {
    throw new Error("DB_URL is not defined in environment variables");
  }

  await mongoose.connect(process.env.DB_URL, {});
  console.log("Database connected successfully");
};

module.exports = connectDB;
