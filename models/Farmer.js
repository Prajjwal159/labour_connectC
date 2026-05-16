const mongoose = require("mongoose");

const farmerSchema = new mongoose.Schema({
    full_name: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        required: false
    },
    
    firebaseUID: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },

    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,

    village: {
        type: String
    },

    subscription_plan: {
        type: String
    },

    subscription_amount: {
        type: Number
    },

    subscription_months: {
        type: Number
    },

    subscription_status: {
        type: String,
        default: "Pending"
    },

    subscription_start_date: {
        type: Date
    },

    subscription_end_date: {
        type: Date
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Farmer", farmerSchema);