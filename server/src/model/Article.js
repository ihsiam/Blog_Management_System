/* eslint-disable comma-dangle */
const { Schema, model } = require('mongoose');

const ArticleSchema = new Schema(
    {
        title: String,
        body: String,
        cover: String,
        status: {
            type: String,
            enum: ['draft', 'published'],
            default: 'draft',
        },
        authorId: {
            type: Schema.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true, id: true }
);

const Article = model('Article', ArticleSchema);

module.exports = Article;
