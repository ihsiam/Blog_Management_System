/* eslint-disable comma-dangle */
const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
    {
        name: String,
        email: String,
        password: String,
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'block', 'declined'],
            default: 'pending',
        },
    },
    { timestamps: true, id: true }
);

const User = model('User', UserSchema);

module.exports = User;
