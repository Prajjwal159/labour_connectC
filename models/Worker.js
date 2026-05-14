const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema({
    full_name: String,
    phone: String,
    email: { type: String, unique: true },
    password: String,
    skill_category: [String],
    experience_level: String,
    village: String
}, { timestamps: true });

module.exports = mongoose.model("Worker", workerSchema);
