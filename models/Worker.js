const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema({
    full_name: String,
    phone: String,
    email: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true,
        trim: true 
    },
    password: { type: String, required: false },
    firebaseUID: { type: String, unique: true, sparse: true, index: true },
    skill_category: [String],
    experience_level: String,
    village: String,
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    verificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date
}, { timestamps: true });

module.exports = mongoose.model("Worker", workerSchema);