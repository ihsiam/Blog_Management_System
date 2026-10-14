const { Schema, model } = require("mongoose");
const schemaOptions = require("./schemaOptions");
const { COMMENT_STATUS } = require("../config/constants");

const CommentSchema = new Schema(
  {
    body: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(COMMENT_STATUS),
      default: COMMENT_STATUS.PUBLIC,
    },
    article_id: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },
    author_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parent_comment_id: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
  },
  schemaOptions,
);

// Indexes
CommentSchema.index({ article_id: 1 });
CommentSchema.index({ author_id: 1 });
CommentSchema.index({ parent_comment_id: 1 });
CommentSchema.index({ status: 1 });

const Comment = model("Comment", CommentSchema);

module.exports = Comment;
