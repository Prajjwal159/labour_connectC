const mongoose = require("mongoose");

const marketplaceItemSchema = new mongoose.Schema({
    farmer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Farmer",
        required: true
    },
    item_title: String,
    category: String,
    item_type: String,
    description: String,
    price: Number,
    location: String,
    contact_phone: String,
    image_url: String,
    status: {
        type: String,
        default: "Available"
    }
}, { timestamps: true });

module.exports = mongoose.model("MarketplaceItem", marketplaceItemSchema);