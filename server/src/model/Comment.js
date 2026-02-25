const { Schema, model } = require("mongoose");
const schemaOptions = require("./schemaOptions");

const CommentSchema = new Schema(
  {
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ["public", "hidden"],
      default: "public",
    },
    article: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  schemaOptions,
);

const Comment = model("Comment", CommentSchema);

module.exports = Comment;
