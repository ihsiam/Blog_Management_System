const { Schema, model } = require("mongoose");
const schemaOptions = require("./schemaOptions");

const PasswordResetTokenSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token_hash: {
      type: String,
      required: true,
      unique: true,
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

// Index
PasswordResetTokenSchema.index({ user_id: 1 });

const PasswordResetToken = model(
  "PasswordResetToken",
  PasswordResetTokenSchema,
);

module.exports = PasswordResetToken;
