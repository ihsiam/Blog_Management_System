const { Schema, model } = require("mongoose");
const schemaOptions = require("./schemaOptions");

const ArticleSchema = new Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    cover_image_url: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },
    author_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
  },
  schemaOptions,
);

// Indexes
ArticleSchema.index({ category_id: 1 });
ArticleSchema.index({ author_id: 1 });
ArticleSchema.index({ status: 1 });
ArticleSchema.index({ createdAt: 1 });
ArticleSchema.index({ title: 1 });

// Virtual populate
ArticleSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "article_id",
  justOne: false,
});

const Article = model("Article", ArticleSchema);

module.exports = Article;
