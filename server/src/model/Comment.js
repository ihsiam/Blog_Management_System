const { Schema, model } = require("mongoose");
const schemaOptions = require("./schemaOptions");

const CommentSchema = new Schema(
  {
    body: String,
    status: {
      type: String,
      enum: ["public", "hidden"],
      default: "public",
    },
    article: {
      type: Schema.Types.ObjectId,
      ref: "Article",
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  schemaOptions,
);

const Comment = model("Comment", CommentSchema);

module.exports = Comment;
