const fs = require("fs");

let content = fs.readFileSync("app.js", "utf8");

// 1. Imports
content = content.replace(
    /const session = require\("express-session"\);/,
    `const session = require("express-session");\nconst MongoStore = require("connect-mongo");\nconst admin = require("./config/firebaseAdmin");`
);

content = content.replace(
    /const paymentSessions = \{\};/,
    `const PaymentSession = require("./models/PaymentSession");`
);

// 2. Session setup
content = content.replace(
    /app\.use\(session\(\{([\s\S]*?)\}\)\);/,
    `app.use(session({
    secret: process.env.SESSION_SECRET || "namma_raitha_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hortix",
        collectionName: 'sessions'
    }),
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));`
);

// 3. res.locals firebase config
content = content.replace(
    /res\.locals\.currentLang = lang;/,
    `res.locals.currentLang = lang;
    res.locals.firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    };`
);

// 4. farmer login
const farmerLoginCode = `app.post("/farmer/login", async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.redirect("/farmer/login");
        
        const decodedToken = await admin.auth().verifyIdToken(token);
        const firebaseUID = decodedToken.uid;
        const email = decodedToken.email;

        let farmer = await Farmer.findOne({ $or: [{ firebaseUID }, { email }] });

        if (!farmer) {
            return res.status(404).json({ error: "Farmer account not found." });
        }

        if (!farmer.firebaseUID) {
            farmer.firebaseUID = firebaseUID;
            await farmer.save();
        }

        req.session.farmer = {
            id: farmer._id.toString(),
            full_name: farmer.full_name,
            email: farmer.email,
            phone: farmer.phone,
            village: farmer.village,
            subscription_plan: farmer.subscription_plan,
            subscription_amount: farmer.subscription_amount,
            subscription_months: farmer.subscription_months,
            subscription_status: farmer.subscription_status,
            subscription_start_date: farmer.subscription_start_date,
            subscription_end_date: farmer.subscription_end_date,
            firebaseUID: farmer.firebaseUID
        };

        res.status(200).json({ success: true, redirect: "/farmer/dashboard" });

    } catch (err) {
        console.log("FIREBASE FARMER LOGIN ERROR:", err);
        res.status(500).json({ error: "Server error during farmer login." });
    }
});`;
content = content.replace(/app\.post\("\/farmer\/login", async \(req, res\) => \{[\s\S]*?res\.render\("error", \{\s*message: "Server error during farmer login\.",\s*backLink: "\/farmer\/login"\s*\}\);\s*\}\s*\}\);/, farmerLoginCode);

// 5. worker login
const workerLoginCode = `app.post("/worker/login", async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.redirect("/worker/login");
        
        const decodedToken = await admin.auth().verifyIdToken(token);
        const firebaseUID = decodedToken.uid;
        const email = decodedToken.email;

        let worker = await Worker.findOne({ $or: [{ firebaseUID }, { email }] });

        if (!worker) {
            return res.status(404).json({ error: "Worker account not found." });
        }

        if (!worker.firebaseUID) {
            worker.firebaseUID = firebaseUID;
            await worker.save();
        }

        req.session.worker = {
            id: worker._id.toString(),
            full_name: worker.full_name,
            email: worker.email,
            phone: worker.phone,
            village: worker.village,
            skill_category: Array.isArray(worker.skill_category)
                ? worker.skill_category.join(",")
                : worker.skill_category,
            experience_level: worker.experience_level,
            firebaseUID: worker.firebaseUID
        };

        res.status(200).json({ success: true, redirect: "/worker/dashboard" });

    } catch (err) {
        console.log("FIREBASE WORKER LOGIN ERROR:", err);
        res.status(500).json({ error: "Server error during worker login." });
    }
});`;
content = content.replace(/app\.post\("\/worker\/login", async \(req, res\) => \{[\s\S]*?res\.render\("error", \{\s*message: "Server error during worker login\.",\s*backLink: "\/worker\/login"\s*\}\);\s*\}\s*\}\);/, workerLoginCode);

// 6. paymentSession inserts
// Farmer Post Job
content = content.replace(
    /paymentSessions\[paymentSessionId\] = \{[\s\S]*?data: \{[\s\S]*?\.\.\.req\.body,\s*currentLang\s*\}\s*\};/,
    `await PaymentSession.create({
            paymentSessionId,
            type: "job_post",
            role: "farmer",
            orderId: order.id,
            amount,
            userId: req.session.farmer.id,
            data: {
                ...req.body,
                currentLang
            }
        });`
);

// Farmer Register
content = content.replace(
    /paymentSessions\[paymentSessionId\] = \{[\s\S]*?data: \{[\s\S]*?full_name,\s*phone,\s*village,\s*email,\s*password,\s*subscription_amount: amount,\s*subscription_months: months,\s*subscription_plan_label: `₹\$\{amount\} - \$\{months\} Months`,\s*currentLang\s*\}\s*\};/,
    `await PaymentSession.create({
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
                firebaseUID: req.body.firebaseUID,
                subscription_amount: amount,
                subscription_months: months,
                subscription_plan_label: \`₹\${amount} - \${months} Months\`,
                currentLang
            }
        });`
);

// Worker Register
content = content.replace(
    /paymentSessions\[paymentSessionId\] = \{[\s\S]*?data: \{[\s\S]*?full_name,\s*phone,\s*village,\s*experience_level,\s*email,\s*password,\s*skill_category,\s*currentLang\s*\}\s*\};/,
    `await PaymentSession.create({
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
                firebaseUID: req.body.firebaseUID,
                skill_category,
                currentLang
            }
        });`
);

// Farmer Renew
content = content.replace(
    /paymentSessions\[paymentSessionId\] = \{[\s\S]*?data: \{[\s\S]*?subscription_amount: amount,\s*subscription_months: months,\s*subscription_plan_label: `₹\$\{amount\} - \$\{months\} Months`,\s*currentLang\s*\}\s*\};/,
    `await PaymentSession.create({
            paymentSessionId,
            type: "subscription_renewal",
            role: "farmer",
            orderId: order.id,
            amount,
            userId: req.session.farmer.id,
            data: {
                subscription_amount: amount,
                subscription_months: months,
                subscription_plan_label: \`₹\${amount} - \${months} Months\`,
                currentLang
            }
        });`
);

// Razorpay verify fetch
content = content.replace(
    /const sessionData = paymentSessions\[paymentSessionId\];/,
    `const sessionData = await PaymentSession.findOne({ paymentSessionId });`
);

// Razorpay verify deletions
content = content.replace(/delete paymentSessions\[paymentSessionId\];/g, `await PaymentSession.findOneAndDelete({ paymentSessionId });`);

// Razorpay verify farmer create (remove password hash and add firebaseUID)
content = content.replace(
    /const hashedPassword = await bcrypt\.hash\(data\.password, 10\);/,
    `const firebaseUID = data.firebaseUID;`
);
content = content.replace(
    /password: hashedPassword,/,
    `firebaseUID: firebaseUID,`
);

// Razorpay verify worker create (remove password hash and add firebaseUID)
content = content.replace(
    /const hashedPassword = await bcrypt\.hash\(data\.password, 10\);/,
    `const firebaseUID = data.firebaseUID;`
);
content = content.replace(
    /password: hashedPassword,/,
    `firebaseUID: firebaseUID,`
);

// Razorpay sessionData.type fix for farmer renewal
content = content.replace(
    /if \(sessionData\.type === "farmer_renewal"\)/g,
    `if (sessionData.type === "subscription_renewal")`
);
content = content.replace(
    /await Farmer\.findByIdAndUpdate\(sessionData\.farmerId/g,
    `await Farmer.findByIdAndUpdate(sessionData.userId`
);


// Forgot Password routes (Firebase handles it now, but we can return error or redirect if visited)
content = content.replace(
    /app\.post\("\/farmer\/forgot-password"[\s\S]*?\}\);/g,
    `app.post("/farmer/forgot-password", async (req, res) => {
        // Handled by Firebase on frontend now
        res.redirect("/farmer/login");
    });`
);

content = content.replace(
    /app\.post\("\/worker\/forgot-password"[\s\S]*?\}\);/g,
    `app.post("/worker/forgot-password", async (req, res) => {
        // Handled by Firebase on frontend now
        res.redirect("/worker/login");
    });`
);


fs.writeFileSync("app.js", content);
console.log("app.js successfully updated.");
