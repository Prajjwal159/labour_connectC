const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
    farmer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Farmer"
    },
    job_title: String,
    category: String,
    work_type: String,
    description: String,
    location: String,
    wage: Number,
    workers_required: Number,
    payment_mode: String,
    start_date: Date,
    end_date: Date,
    status: {
        type: String,
        default: "Open"
    },
    version: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

module.exports = mongoose.model("Job", jobSchema);