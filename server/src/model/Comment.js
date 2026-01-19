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
        article: {
            type: Schema.ObjectId,
            ref: 'Article',
        },
        author: {
            type: Schema.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

const Comment = model('Comment', CommentSchema);

module.exports = Comment;
