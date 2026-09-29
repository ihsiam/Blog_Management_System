const { Schema, model } = require("mongoose");
const schemaOptions = require("./schemaOptions");

const OtpSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    purpose: {
      type: String,
      enum: ["email_verification", "password_reset"],
      required: true,
    },
    code_hash: {
      type: String,
      required: true,
    },
    is_used: {
      type: Boolean,
      default: false,
    },
    // Valid for 5 minutes
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  schemaOptions,
);

OtpSchema.index({ user_id: 1, purpose: 1 }, { unique: true });

const OTP = model("OTP", OtpSchema);

module.exports = OTP;
