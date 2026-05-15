const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    userType: {
        type: String,
        enum: ["farmer", "worker"],
        required: true
    },

    title: String,

    message: String,

    link: String,

    type: {
        type: String,
        enum: ["scheme", "job", "marketplace", "payment", "general"]
    },

    isRead: {
        type: Boolean,
        default: false
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Notification", notificationSchema);