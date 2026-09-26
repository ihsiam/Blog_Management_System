const { Schema, model } = require("mongoose");

const schemaOptions = require("./schemaOptions");

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      unique: true,
      required: true,
    },

    password_hash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    account_status: {
      type: String,
      enum: ["pending", "active", "blocked"],
      default: "pending",
    },
  },
  schemaOptions,
);

// Indexes
UserSchema.index({ role: 1 });
UserSchema.index({ account_status: 1 });

// Virtual relationships
UserSchema.virtual("sessions", {
  ref: "Session",
  localField: "_id",
  foreignField: "user_id",
  justOne: false,
});

UserSchema.virtual("otp", {
  ref: "OTP",
  localField: "_id",
  foreignField: "user_id",
  justOne: false,
});

UserSchema.virtual("PasswordResetToken", {
  ref: "PasswordResetToken",
  localField: "_id",
  foreignField: "user_id",
  justOne: false,
});

UserSchema.virtual("articles", {
  ref: "Article",
  localField: "_id",
  foreignField: "author_id",
  justOne: false,
});

UserSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "author_id",
  justOne: false,
});

const User = model("User", UserSchema);

module.exports = User;
