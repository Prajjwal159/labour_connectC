const mongoose = require("mongoose");
const dns = require("dns");

// Set DNS servers to bypass local resolution issues with MongoDB SRV records
try {
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
} catch (e) {
    console.log("Note: Could not set custom DNS servers, using system defaults.");
}

async function connectMongoDB() {
    try {
        const mongoUri = process.env.MONGO_URI.trim();

        await mongoose.connect(mongoUri);

        console.log("MongoDB Connected Successfully");
    } catch (error) {
        console.log("MongoDB Connection Error:", error);
        process.exit(1);
    }
}

module.exports = connectMongoDB;