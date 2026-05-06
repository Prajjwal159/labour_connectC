const mongoose = require("mongoose");

const jobApplicationSchema = new mongoose.Schema({
    job_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
        required: true
    },
    worker_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Worker",
        required: true
    },
    job_version: {
        type: Number,
        default: 1
    },
    application_status: {
        type: String,
        default: "Applied"
    }
}, { timestamps: true });

module.exports = mongoose.model("JobApplication", jobApplicationSchema);