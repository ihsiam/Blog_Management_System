/* eslint-disable comma-dangle */
const { Schema, model } = require('mongoose');

const CommentSchema = new Schema(
    {
        body: String,
        status: {
            type: String,
            enum: ['public', 'hidden'],
            default: 'public',
        },
        articleId: {
            type: Schema.ObjectId,
            ref: 'Article',
        },
        authorId: {
            type: Schema.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true, id: true }
);

const Comment = model('Comment', CommentSchema);

module.exports = Comment;
