const { Schema, model } = require("mongoose");

const schemaOptions = require("./schemaOptions");

const SessionSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    refresh_token_hash: {
      type: String,
      required: true,
      unique: true,
    },

    device_info: {
      type: String,
      required: true,
    },

    // Valid for 30 days
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  schemaOptions,
);

// Index
SessionSchema.index({ user_id: 1 });

const Session = model("Session", SessionSchema);

module.exports = Session;
