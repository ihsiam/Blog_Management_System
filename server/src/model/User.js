const { Schema, model } = require("mongoose");

const UserSchema = new Schema(
  {
    name: String,
    email: {
      type: String,
      unique: true,
    },
    password: String,
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "block", "declined"],
      default: "pending",
    },
  },
  { timestamps: true },
);

const User = model("User", UserSchema);

module.exports = User;
