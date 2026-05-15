const Notification = require("../models/Notification");

const sendNotification = async (
    userId,
    userType,
    title,
    message,
    type,
    link = "#"
) => {

    try {

        await Notification.create({
            userId,
            userType,
            title,
            message,
            type,
            link
        });

    } catch (err) {
        console.log("NOTIFICATION ERROR:", err);
    }
};

module.exports = sendNotification;