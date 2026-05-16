const fs = require("fs");

let content = fs.readFileSync("app.js", "utf8");

// 1. Add trust proxy
if (!content.includes('app.set("trust proxy"')) {
    content = content.replace(
        /const app = express\(\);/,
        `const app = express();\napp.set("trust proxy", 1);`
    );
}

// 2. Fix Email Verification for /farmer/login
content = content.replace(
    /const email = decodedToken\.email;\s*let farmer = await Farmer\.findOne\(\{ \$or: \[\{ firebaseUID \}, \{ email \}\] \}\);/,
    `const email = decodedToken.email;
        if (!decodedToken.email_verified) {
            return res.status(403).json({ error: "Please verify your email address via the link sent to your inbox before logging in." });
        }
        let farmer = await Farmer.findOne({ $or: [{ firebaseUID }, { email }] });`
);

// 3. Fix Email Verification for /worker/login
content = content.replace(
    /const email = decodedToken\.email;\s*let worker = await Worker\.findOne\(\{ \$or: \[\{ firebaseUID \}, \{ email \}\] \}\);/,
    `const email = decodedToken.email;
        if (!decodedToken.email_verified) {
            return res.status(403).json({ error: "Please verify your email address via the link sent to your inbox before logging in." });
        }
        let worker = await Worker.findOne({ $or: [{ firebaseUID }, { email }] });`
);

// 4. Update farmer/register to expect firebaseToken instead of firebaseUID
content = content.replace(
    /app\.post\("\/farmer\/register", async \(req, res\) => \{[\s\S]*?firebaseUID: req\.body\.firebaseUID,/,
    `app.post("/farmer/register", async (req, res) => {
    try {
        const {
            full_name,
            phone,
            village,
            subscription_plan,
            firebaseToken
        } = req.body;

        const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        const email = decodedToken.email;

        // Validation
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ error: "Invalid phone number." });
        }

        let amount = 0;
        let months = 0;
        if (subscription_plan === "plan-1") { amount = 99; months = 1; }
        else if (subscription_plan === "plan-6") { amount = 499; months = 6; }
        else if (subscription_plan === "plan-12") { amount = 899; months = 12; }
        else {
            return res.status(400).json({ error: "Invalid subscription plan." });
        }

        const paymentSessionId = crypto.randomBytes(16).toString("hex");

        const order = await createRazorpayOrder(amount, paymentSessionId);

        const currentLang = req.query.lang === "kn" ? "kn" : "en";

        await PaymentSession.create({
            paymentSessionId,
            type: "farmer_register",
            role: "farmer",
            orderId: order.id,
            amount,
            data: {
                full_name,
                phone,
                village,
                email,
                firebaseUID: decodedToken.uid,`
);

// 5. Update worker/register to expect firebaseToken
content = content.replace(
    /app\.post\("\/worker\/register", async \(req, res\) => \{[\s\S]*?firebaseUID: req\.body\.firebaseUID,/,
    `app.post("/worker/register", async (req, res) => {
    try {
        const {
            full_name,
            phone,
            village,
            experience_level,
            skill_category,
            firebaseToken
        } = req.body;

        const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        const email = decodedToken.email;

        // Validation
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ error: "Invalid phone number." });
        }

        const amount = process.env.WORKER_REGISTRATION_FEE || 49;
        const paymentSessionId = crypto.randomBytes(16).toString("hex");
        const order = await createRazorpayOrder(amount, paymentSessionId);
        const currentLang = req.query.lang === "kn" ? "kn" : "en";

        await PaymentSession.create({
            paymentSessionId,
            type: "worker_register",
            role: "worker",
            orderId: order.id,
            amount,
            data: {
                full_name,
                phone,
                village,
                experience_level,
                email,
                firebaseUID: decodedToken.uid,`
);

// 6. Rollback Firebase User on Razorpay Error
content = content.replace(
    /console\.log\("MONGO REGISTER ERROR:", error\);[\s\S]*?return res\.render\("error", \{/,
    `console.log("MONGO REGISTER ERROR:", error);
        if (data && data.firebaseUID) {
            try {
                await admin.auth().deleteUser(data.firebaseUID);
                console.log("Rollback: Deleted orphaned Firebase user");
            } catch(e) {
                console.error("Rollback failed:", e);
            }
        }
        return res.render("error", {`
);


fs.writeFileSync("app.js", content);
console.log("app.js HP issues fixed");
