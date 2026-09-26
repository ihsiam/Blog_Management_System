const { Schema, model } = require("mongoose");
const schemaOptions = require("./schemaOptions");

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      unique: true,
      required: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "unavailable"],
      default: "active",
    },
  },
  schemaOptions,
);

/**
 * Index
 * `name` is already indexed via `unique: true` above.
 */
CategorySchema.index({ status: 1 });

// Virtual populate
CategorySchema.virtual("articles", {
  ref: "Article",
  localField: "_id",
  foreignField: "category_id",
  justOne: false,
});

const Category = model("Category", CategorySchema);
module.exports = Category;
