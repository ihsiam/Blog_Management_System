const { Schema, model } = require("mongoose");

const ArticleSchema = new Schema(
  {
    title: String,
    body: String,
    cover: String,
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    author: {
      type: Schema.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

const Article = model("Article", ArticleSchema);

module.exports = Article;
