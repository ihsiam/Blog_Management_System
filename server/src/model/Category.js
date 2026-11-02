const { Schema, model } = require("mongoose");
const schemaOptions = require("./schemaOptions");
const { CATEGORY_STATUS } = require("../config/constants");

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
      enum: Object.values(CATEGORY_STATUS),
      default: CATEGORY_STATUS.ACTIVE,
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
