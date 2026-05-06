const mongoose = require("mongoose");

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