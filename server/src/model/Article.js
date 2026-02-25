const { Schema, model } = require("mongoose");
const schemaOptions = require("./schemaOptions");

const ArticleSchema = new Schema(
  {
    title: { type: String, required: true },
    body: String,
    cover: String,
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  schemaOptions,
);

// Virtual populate
ArticleSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "article",
  justOne: false,
});

const Article = model("Article", ArticleSchema);

module.exports = Article;
