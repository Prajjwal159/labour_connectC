const mongoose = require('mongoose');

const paymentSessionSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    paymentSessionId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false // May be null for worker registration before profile creation
    },
    role: {
        type: String,
        enum: ['farmer', 'worker'],
        required: true
    },
    type: {
        type: String,
        enum: ['job_post', 'farmer_register', 'worker_register', 'subscription_renewal'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

module.exports = mongoose.model('PaymentSession', paymentSessionSchema);
