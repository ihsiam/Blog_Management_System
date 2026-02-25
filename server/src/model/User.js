const { Schema, model } = require("mongoose");
const schemaOptions = require("./schemaOptions");

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
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
  schemaOptions,
);

const User = model("User", UserSchema);

module.exports = User;
