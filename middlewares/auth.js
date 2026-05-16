const admin = require("../config/firebaseAdmin");

const requireAuth = (req, res, next) => {
    if (req.session && (req.session.farmer || req.session.worker)) {
        return next();
    }
    const currentLang = req.query.lang || "en";
    res.redirect(`/?lang=${currentLang}`);
};

const requireFarmer = (req, res, next) => {
    if (req.session && req.session.farmer) {
        return next();
    }
    const currentLang = req.query.lang || "en";
    res.redirect(`/farmer/login?lang=${currentLang}`);
};

const requireWorker = (req, res, next) => {
    if (req.session && req.session.worker) {
        return next();
    }
    const currentLang = req.query.lang || "en";
    res.redirect(`/worker/login?lang=${currentLang}`);
};

const verifyFirebaseToken = async (req, res, next) => {
    const token = req.body.token || req.headers.authorization?.split("Bearer ")[1];
    if (!token) {
        return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.firebaseUser = decodedToken;
        next();
    } catch (error) {
        console.error("Firebase Token Verification Error:", error);
        res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
    }
};

module.exports = {
    requireAuth,
    requireFarmer,
    requireWorker,
    verifyFirebaseToken
};
