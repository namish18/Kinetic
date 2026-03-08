const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    githubId: {
        type: String,
        required: true,
        unique: true,
    },
    github: {
        type: String,
        required: true,
    },
    displayName: {
        type: String,
    },
    email: {
        type: String,
    },
    avatarUrl: {
        type: String,
    },
    did: {
        type: String,
        unique: true,
    },
    ipfsCID: {
        type: String,
    },
    wallet: {
        type: String,
        default: null,
    },
    didDocument: {
        type: Object,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

userSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('User', userSchema);
