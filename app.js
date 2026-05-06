const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const axios = require("axios");
require("dotenv").config();
// const db = require("./config/db");
const connectMongoDB = require("./config/mongodb");
connectMongoDB();
const translations = require("./locales/translations");
const os = require("os");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Farmer = require("./models/Farmer");
const Worker = require("./models/Worker");
const Job = require("./models/Job");
const JobApplication = require("./models/JobApplication");
const MarketplaceItem = require("./models/MarketplaceItem");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const paymentSessions = {};

function createRazorpayOrder(amount, receipt) {
    return razorpay.orders.create({
        amount: Math.round(Number(amount) * 100),
        currency: "INR",
        receipt
    });
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
    const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(orderId + "|" + paymentId)
        .digest("hex");

    return generatedSignature === signature;
}

function getLocalIp() {
    const nets = os.networkInterfaces();

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === "IPv4" && !net.internal) {
                return net.address;
            }
        }
    }

    return "localhost";
}

function checkSubscription(req, res, next) {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const farmer = req.session.farmer;

    if (!farmer.subscription_end_date) {
        req.subscriptionExpired = false;
        return next();
    }

    const today = new Date();
    const expiry = new Date(farmer.subscription_end_date);

    req.subscriptionExpired = today > expiry;

    next();
}

function getSubscriptionWarning(subscriptionEndDate) {
    if (!subscriptionEndDate) return null;

    const today = new Date();
    const expiry = new Date(subscriptionEndDate);

    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return {
            type: "expired",
            daysLeft: 0,
            message: "Your subscription has expired."
        };
    }

    if (diffDays <= 3) {
        return {
            type: "warning",
            daysLeft: diffDays,
            message: `Your subscription will expire in ${diffDays} day${diffDays === 1 ? "" : "s"}. Please renew soon.`
        };
    }

    return null;
}

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "namma_raitha_secret",
    resave: false,
    saveUninitialized: true
}));

app.use((req, res, next) => {
    const lang = req.query.lang === "kn" ? "kn" : "en";

    res.locals.currentLang = lang;
    res.locals.t = (key) => {
        return translations[lang][key] || key;
    };

    next();
});

// Static files
app.use(express.static(path.join(__dirname, "public")));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/farmer/login", (req, res) => {
    res.render("farmer-login");
});

app.post("/farmer/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const farmer = await Farmer.findOne({ email });

        if (!farmer) {
            return res.render("error", {
                message: "Farmer account not found.",
                backLink: "/farmer/login"
            });
        }

        const isMatch = await bcrypt.compare(password, farmer.password);

        if (!isMatch) {
            return res.render("error", {
                message: "Invalid password. Please try again.",
                backLink: "/farmer/login"
            });
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
            subscription_end_date: farmer.subscription_end_date
        };

        res.redirect("/farmer/dashboard");

    } catch (err) {
        console.log("MONGO FARMER LOGIN ERROR:", err);
        res.render("error", {
            message: "Server error during farmer login.",
            backLink: "/farmer/login"
        });
    }
});

app.get("/worker/login", (req, res) => {
    res.render("worker-login");
});

app.post("/worker/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const worker = await Worker.findOne({ email });

        if (!worker) {
            return res.render("error", {
                message: "Worker account not found.",
                backLink: "/worker/login"
            });
        }

        const isMatch = await bcrypt.compare(password, worker.password);

        if (!isMatch) {
            return res.render("error", {
                message: "Invalid password. Please try again.",
                backLink: "/worker/login"
            });
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
            experience_level: worker.experience_level
        };

        res.redirect("/worker/dashboard");

    } catch (err) {
        console.log("MONGO WORKER LOGIN ERROR:", err);

        res.render("error", {
            message: "Server error during worker login.",
            backLink: "/worker/login"
        });
    }
});

app.get("/worker/dashboard", (req, res) => {
    if (!req.session.worker) {
        return res.redirect("/worker/login");
    }

    res.render("worker-dashboard", { worker: req.session.worker });
});

app.get("/farmer/register", (req, res) => {
    res.render("farmer-register");
});

app.get("/worker/register", (req, res) => {
    res.render("worker-register");
});

app.get("/farmer/post-job", checkSubscription,(req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }
    if (req.subscriptionExpired) {
    return res.render("message", {
        title: "Subscription Expired",
        message: "Renew subscription to post jobs.",
        backLink: "/farmer/renew-subscription"
    });
}

    res.render("post-job");
});

app.post("/farmer/post-job", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) {
            return res.redirect("/farmer/login");
        }

        if (req.subscriptionExpired) {
            return res.render("message", {
                title: "Subscription Expired",
                message: "Renew subscription to post jobs.",
                backLink: "/farmer/renew-subscription"
            });
        }

        const currentLang = req.query.lang || "en";
        const amount = process.env.JOB_POSTING_FEE || 29;

        const paymentSessionId = crypto.randomBytes(16).toString("hex");
        const order = await createRazorpayOrder(amount, `job_post_${Date.now()}`);

        paymentSessions[paymentSessionId] = {
            type: "job_post",
            orderId: order.id,
            amount,
            farmerId: req.session.farmer.id,
            data: {
                ...req.body,
                currentLang
            }
        };

        res.render("razorpay-payment", {
            title: "Job Posting Payment",
            amount,
            order,
            paymentSessionId,
            keyId: process.env.RAZORPAY_KEY_ID,
            currentLang,
            cancelLink: "/farmer/post-job",
            customerName: req.session.farmer.full_name,
            customerEmail: req.session.farmer.email,
            customerPhone: req.session.farmer.phone
        });

    } catch (err) {
        console.log("JOB POST PAYMENT ERROR:", err);
        res.render("error", {
            message: "Unable to start job posting payment.",
            backLink: "/farmer/post-job"
        });
    }
});


app.post("/farmer/register", async (req, res) => {
    try {
        const { full_name, phone, village, email, password, subscription_plan } = req.body;
        const currentLang = req.query.lang || "en";

        if (!subscription_plan) {
            return res.render("error", {
                message: "Please select a subscription plan.",
                backLink: `/farmer/register?lang=${currentLang}`
            });
        }

        const [amount, months] = subscription_plan.split("|");

        const paymentSessionId = crypto.randomBytes(16).toString("hex");
        const order = await createRazorpayOrder(amount, `farmer_reg_${Date.now()}`);

        paymentSessions[paymentSessionId] = {
            type: "farmer_register",
            orderId: order.id,
            amount,
            data: {
                full_name,
                phone,
                village,
                email,
                password,
                subscription_amount: amount,
                subscription_months: months,
                subscription_plan_label: `₹${amount} - ${months} Months`,
                currentLang
            }
        };

        res.render("razorpay-payment", {
            title: "Farmer Subscription Payment",
            amount,
            order,
            paymentSessionId,
            keyId: process.env.RAZORPAY_KEY_ID,
            currentLang,
            cancelLink: "/farmer/register",
            customerName: full_name,
            customerEmail: email,
            customerPhone: phone
        });

    } catch (err) {
        console.log("FARMER REGISTER PAYMENT ERROR:", err);
        res.render("error", {
            message: "Unable to start Razorpay payment.",
            backLink: "/farmer/register"
        });
    }
});

app.get("/farmer/dashboard", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) {
            return res.redirect("/farmer/login");
        }

        const farmer = req.session.farmer;

        const jobs = await Job.find({ farmer_id: farmer.id })
            .sort({ createdAt: -1 })
            .lean();

        const formattedJobs = jobs.map(job => ({
            ...job,
            id: job._id
        }));

        const totalItems = await MarketplaceItem.countDocuments({
            farmer_id: farmer.id
        });

        const availableItems = await MarketplaceItem.countDocuments({
            farmer_id: farmer.id,
            status: "Available"
        });

        const soldItems = await MarketplaceItem.countDocuments({
            farmer_id: farmer.id,
            status: "Sold"
        });

        const recentMarketplaceItemsRaw = await MarketplaceItem.find({
            farmer_id: farmer.id
        })
            .sort({ createdAt: -1 })
            .limit(4)
            .lean();

        const recentMarketplaceItems = recentMarketplaceItemsRaw.map(item => ({
            ...item,
            id: item._id
        }));

        const marketplaceSummary = {
            total_items: totalItems,
            available_items: availableItems,
            sold_items: soldItems
        };

        const subscriptionWarning = getSubscriptionWarning(farmer.subscription_end_date);

        res.render("farmer-dashboard", {
            farmer,
            jobs: formattedJobs,
            marketplaceSummary,
            recentMarketplaceItems,
            subscriptionWarning,
            subscriptionExpired: req.subscriptionExpired
        });

    } catch (err) {
        console.log("MONGO FARMER DASHBOARD ERROR:", err);

        res.render("error", {
            message: "Error loading farmer dashboard.",
            backLink: "/farmer/login"
        });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send("Error logging out.");
        }
        res.redirect("/");
    });
});

app.post("/worker/register", async (req, res) => {
    try {
        const { full_name, phone, village, experience_level, email, password } = req.body;
        let { skill_category } = req.body;
        const currentLang = req.query.lang || "en";

        if (!skill_category || (Array.isArray(skill_category) && skill_category.length === 0)) {
            return res.render("error", {
                message: "Please select at least one skill.",
                backLink: "/worker/register"
            });
        }

        if (Array.isArray(skill_category)) {
            skill_category = skill_category.join(",");
        }

        const amount = process.env.WORKER_REGISTRATION_FEE || 49;
        const paymentSessionId = crypto.randomBytes(16).toString("hex");
        const order = await createRazorpayOrder(amount, `worker_reg_${Date.now()}`);

        paymentSessions[paymentSessionId] = {
            type: "worker_register",
            orderId: order.id,
            amount,
            data: {
                full_name,
                phone,
                village,
                experience_level,
                email,
                password,
                skill_category,
                currentLang
            }
        };

        res.render("razorpay-payment", {
            title: "Worker Registration Fee",
            amount,
            order,
            paymentSessionId,
            keyId: process.env.RAZORPAY_KEY_ID,
            currentLang,
            cancelLink: "/worker/register",
            customerName: full_name,
            customerEmail: email,
            customerPhone: phone
        });

    } catch (error) {
        console.log("WORKER PAYMENT ERROR:", error);
        res.render("error", {
            message: "Unable to start worker registration payment.",
            backLink: "/worker/register"
        });
    }
});

app.get("/worker/jobs", async (req, res) => {
    try {
        if (!req.session.worker) {
            return res.redirect("/worker/login");
        }

        const {
            keyword = "",
            location = "",
            category = "",
            work_type = "",
            min_wage = "",
            payment_mode = "",
            sort = ""
        } = req.query;

        const filter = { status: "Open" };

        if (keyword) filter.job_title = { $regex: keyword, $options: "i" };
        if (location) filter.location = { $regex: location, $options: "i" };
        if (category) filter.category = category;
        if (work_type) filter.work_type = work_type;
        if (payment_mode) filter.payment_mode = payment_mode;
        if (min_wage) filter.wage = { $gte: Number(min_wage) };

        let query = Job.find(filter).lean();

        if (sort === "highest_wage") {
            query = query.sort({ wage: -1, createdAt: -1 });
        } else {
            query = query.sort({ createdAt: -1 });
        }

        const jobs = await query;

        const workerSkills = (req.session.worker.skill_category || "")
            .split(",")
            .map(skill => skill.trim())
            .filter(skill => skill !== "");

        res.render("worker-jobs", {
            jobs,
            filters: {
                keyword,
                location,
                category,
                work_type,
                min_wage,
                payment_mode,
                sort
            },
            workerSkills
        });

    } catch (err) {
        console.log("MONGO WORKER JOBS ERROR:", err);
        res.render("error", {
            message: "Error fetching jobs.",
            backLink: "/worker/dashboard"
        });
    }
});

app.post("/worker/apply/:jobId", async (req, res) => {
    try {
        if (!req.session.worker) {
            return res.redirect("/worker/login");
        }

        const worker_id = req.session.worker.id;
        const job_id = req.params.jobId;
        const currentLang = req.query.lang || "en";

        const job = await Job.findOne({ _id: job_id, status: "Open" });

        if (!job) {
            return res.render("message", {
                title: "Job Not Found",
                message: "This job is unavailable or no longer open.",
                backLink: `/worker/jobs?lang=${currentLang}`
            });
        }

        const currentVersion = job.version || 1;

        const totalApplied = await JobApplication.countDocuments({
            job_id,
            job_version: currentVersion,
            application_status: { $in: ["Applied", "Accepted"] }
        });

        if (totalApplied >= job.workers_required) {
            job.status = "Closed";
            await job.save();

            return res.render("message", {
                title: "Job Full",
                message: "This job has already reached the required number of workers.",
                backLink: `/worker/jobs?lang=${currentLang}`
            });
        }

        const alreadyApplied = await JobApplication.findOne({
            job_id,
            worker_id,
            job_version: currentVersion
        });

        if (alreadyApplied) {
            return res.render("message", {
                title: "Already Applied",
                message: "You have already applied for this job.",
                backLink: `/worker/jobs?lang=${currentLang}`
            });
        }

        await JobApplication.create({
            job_id,
            worker_id,
            job_version: currentVersion
        });

        const updatedApplied = await JobApplication.countDocuments({
            job_id,
            job_version: currentVersion,
            application_status: { $in: ["Applied", "Accepted"] }
        });

        if (updatedApplied >= job.workers_required) {
            job.status = "Closed";
            await job.save();
        }

        return res.render("message", {
            title: "Application Submitted",
            message: `You have successfully applied. Current filled workers: ${updatedApplied}/${job.workers_required}.`,
            backLink: `/worker/jobs?lang=${currentLang}`
        });

    } catch (err) {
        console.log("MONGO APPLY ERROR:", err);
        res.render("error", {
            message: "There was a problem while applying.",
            backLink: "/worker/jobs"
        });
    }
});

app.get("/farmer/job-applications/:jobId", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) {
            return res.redirect("/farmer/login");
        }

        const jobId = req.params.jobId;

        const job = await Job.findOne({
            _id: jobId,
            farmer_id: req.session.farmer.id
        }).lean();

        if (!job) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        const applications = await JobApplication.find({ job_id: jobId })
            .populate("worker_id")
            .sort({ job_version: -1, createdAt: -1 })
            .lean();

        const groupedApplications = {};

        applications.forEach(app => {
            const version = app.job_version || 1;

            if (!groupedApplications[version]) {
                groupedApplications[version] = [];
            }

            groupedApplications[version].push({
                id: app._id,
                application_status: app.application_status,
                job_version: app.job_version,
                applied_at: app.createdAt,
                full_name: app.worker_id?.full_name,
                email: app.worker_id?.email,
                phone: app.worker_id?.phone,
                village: app.worker_id?.village,
                skill_category: Array.isArray(app.worker_id?.skill_category)
                    ? app.worker_id.skill_category.join(", ")
                    : app.worker_id?.skill_category,
                experience_level: app.worker_id?.experience_level
            });
        });

        res.render("job-applications", {
            job,
            groupedApplications
        });

    } catch (err) {
        console.log("MONGO FARMER JOB APPLICATIONS ERROR:", err);
        res.render("error", {
            message: "Error fetching applications.",
            backLink: "/farmer/dashboard"
        });
    }
});

app.post("/farmer/application/update/:appId", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) {
            return res.redirect("/farmer/login");
        }

        const appId = req.params.appId;
        const { status, jobId } = req.body;

        await JobApplication.findByIdAndUpdate(appId, {
            application_status: status
        });

        res.redirect(`/farmer/job-applications/${jobId}`);

    } catch (err) {
        console.log("MONGO APPLICATION UPDATE ERROR:", err);
        res.render("error", {
            message: "Error updating application.",
            backLink: "/farmer/dashboard"
        });
    }
});

app.get("/worker/my-applications", async (req, res) => {
    try {
        if (!req.session.worker) {
            return res.redirect("/worker/login");
        }

        const applications = await JobApplication.find({
            worker_id: req.session.worker.id
        })
        .populate("job_id")
        .sort({ createdAt: -1 })
        .lean();

        const formattedApplications = applications
            .filter(app => app.job_id)
            .map(app => ({
                application_status: app.application_status,
                job_version: app.job_version,
                job_title: app.job_id.job_title,
                category: app.job_id.category,
                location: app.job_id.location,
                wage: app.job_id.wage,
                job_id: app.job_id._id,
                current_job_version: app.job_id.version
            }));

        res.render("worker-applications", {
            applications: formattedApplications
        });

    } catch (err) {
        console.log("MONGO MY APPLICATIONS ERROR:", err);
        res.render("error", {
            message: "Error fetching applications.",
            backLink: "/worker/dashboard"
        });
    }
});

app.get("/farmer/forgot-password", (req, res) => {
    res.render("farmer-forgot-password");
});

app.post("/farmer/forgot-password", async (req, res) => {
    try {
        const { email, phone, newPassword } = req.body;

        const farmer = await Farmer.findOne({ email, phone });

        if (!farmer) {
            return res.render("error", {
                message: "Farmer account not found with given email and phone.",
                backLink: "/farmer/forgot-password"
            });
        }

        farmer.password = await bcrypt.hash(newPassword, 10);
        await farmer.save();

        return res.render("message", {
            title: "Password Updated",
            message: "Your farmer password has been updated successfully.",
            backLink: "/farmer/login"
        });

    } catch (error) {
        console.log("MONGO FARMER FORGOT PASSWORD ERROR:", error);

        return res.render("error", {
            message: "Server error.",
            backLink: "/farmer/forgot-password"
        });
    }
});

app.get("/worker/forgot-password", (req, res) => {
    res.render("worker-forgot-password");
});

app.post("/worker/forgot-password", async (req, res) => {
    try {
        const { email, phone, newPassword } = req.body;

        const worker = await Worker.findOne({ email, phone });

        if (!worker) {
            return res.render("error", {
                message: "Worker account not found with given email and phone.",
                backLink: "/worker/forgot-password"
            });
        }

        worker.password = await bcrypt.hash(newPassword, 10);
        await worker.save();

        return res.render("message", {
            title: "Password Updated",
            message: "Your worker password has been updated successfully.",
            backLink: "/worker/login"
        });

    } catch (error) {
        console.log("MONGO WORKER FORGOT PASSWORD ERROR:", error);

        return res.render("error", {
            message: "Server error.",
            backLink: "/worker/forgot-password"
        });
    }
});

app.get("/farmer/edit-job/:jobId", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) return res.redirect("/farmer/login");

        const job = await Job.findOne({
            _id: req.params.jobId,
            farmer_id: req.session.farmer.id
        }).lean();

        if (!job) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        res.render("edit-job", { job });

    } catch (err) {
        console.log("MONGO EDIT JOB GET ERROR:", err);
        res.render("error", {
            message: "Error fetching job details.",
            backLink: "/farmer/dashboard"
        });
    }
});

app.post("/farmer/edit-job/:jobId", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) return res.redirect("/farmer/login");

        const {
            job_title,
            category,
            work_type,
            description,
            location,
            wage,
            workers_required,
            payment_mode,
            start_date,
            end_date
        } = req.body;

        const job = await Job.findOne({
            _id: req.params.jobId,
            farmer_id: req.session.farmer.id
        });

        if (!job) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        job.job_title = job_title;
        job.category = category;
        job.work_type = work_type;
        job.description = description || "";
        job.location = location;
        job.wage = Number(wage);
        job.workers_required = Number(workers_required);
        job.payment_mode = payment_mode;
        job.start_date = start_date || null;
        job.end_date = end_date || null;
        job.version = (job.version || 1) + 1;

        await job.save();

        res.render("message", {
            title: "Job Updated",
            message: `Your job details were updated successfully. This job is now on version ${job.version}.`,
            backLink: "/farmer/dashboard"
        });

    } catch (err) {
        console.log("MONGO EDIT JOB POST ERROR:", err);
        res.render("error", {
            message: "Error updating job.",
            backLink: "/farmer/dashboard"
        });
    }
});

app.get("/farmer/job-history/:jobId", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) {
            return res.redirect("/farmer/login");
        }

        const job = await Job.findOne({
            _id: req.params.jobId,
            farmer_id: req.session.farmer.id
        }).lean();

        if (!job) {
            return res.render("error", {
                message: "Job not found.",
                backLink: "/farmer/dashboard"
            });
        }

        res.render("message", {
            title: "Job History",
            message: `This job is currently on version ${job.version || 1}. Full MongoDB version history will be added after main migration.`,
            backLink: "/farmer/dashboard"
        });

    } catch (err) {
        console.log("MONGO JOB HISTORY ERROR:", err);
        res.render("error", {
            message: "Error fetching job history.",
            backLink: "/farmer/dashboard"
        });
    }
});

app.post("/farmer/restore-job-version/:jobId/:version", checkSubscription, async (req, res) => {
    res.render("message", {
        title: "Restore Disabled",
        message: "Restore version feature will be added after MongoDB migration is complete.",
        backLink: "/farmer/dashboard"
    });
});

app.post("/farmer/delete-job/:jobId", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) return res.redirect("/farmer/login");

        const job = await Job.findOne({
            _id: req.params.jobId,
            farmer_id: req.session.farmer.id
        });

        if (!job) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        await JobApplication.deleteMany({ job_id: job._id });
        await Job.findByIdAndDelete(job._id);

        res.render("message", {
            title: "Job Deleted",
            message: "The job was deleted successfully.",
            backLink: "/farmer/dashboard"
        });

    } catch (err) {
        console.log("MONGO DELETE JOB ERROR:", err);
        res.render("error", {
            message: "Error deleting job.",
            backLink: "/farmer/dashboard"
        });
    }
});

app.post("/farmer/close-job/:jobId", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) return res.redirect("/farmer/login");

        await Job.findOneAndUpdate(
            { _id: req.params.jobId, farmer_id: req.session.farmer.id },
            { status: "Closed" }
        );

        res.render("message", {
            title: "Job Closed",
            message: "This job has been closed successfully.",
            backLink: "/farmer/dashboard"
        });

    } catch (err) {
        console.log("MONGO CLOSE JOB ERROR:", err);
        res.render("error", {
            message: "Error closing job.",
            backLink: "/farmer/dashboard"
        });
    }
});

app.post("/farmer/reopen-job/:jobId", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) return res.redirect("/farmer/login");

        await Job.findOneAndUpdate(
            { _id: req.params.jobId, farmer_id: req.session.farmer.id },
            { status: "Open" }
        );

        res.render("message", {
            title: "Job Reopened",
            message: "This job has been reopened successfully.",
            backLink: "/farmer/dashboard"
        });

    } catch (err) {
        console.log("MONGO REOPEN JOB ERROR:", err);
        res.render("error", {
            message: "Error reopening job.",
            backLink: "/farmer/dashboard"
        });
    }
});

app.get("/test-phone", (req, res) => {
    res.send("Phone reached laptop server successfully");
});

const PORT = process.env.PORT || 5000;

app.get("/marketplace", async (req, res) => {
    try {
        const { category = "", item_type = "", location = "", keyword = "" } = req.query;

        const filter = { status: "Available" };

        if (category) filter.category = category;
        if (item_type) filter.item_type = item_type;
        if (location) filter.location = { $regex: location, $options: "i" };
        if (keyword) filter.item_title = { $regex: keyword, $options: "i" };

        const items = await MarketplaceItem.find(filter)
            .populate("farmer_id", "full_name")
            .sort({ createdAt: -1 })
            .lean();

        const formattedItems = items.map(item => ({
            ...item,
            id: item._id,
            full_name: item.farmer_id?.full_name || "Farmer"
        }));

        res.render("marketplace", {
            items: formattedItems,
            filters: { category, item_type, location, keyword }
        });

    } catch (err) {
        console.log("MONGO MARKETPLACE ERROR:", err);
        res.render("error", {
            message: "Error fetching marketplace items.",
            backLink: "/"
        });
    }
});

app.get("/farmer/my-marketplace-items", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) return res.redirect("/farmer/login");

        const items = await MarketplaceItem.find({
            farmer_id: req.session.farmer.id
        }).sort({ createdAt: -1 }).lean();

        const formattedItems = items.map(item => ({
            ...item,
            id: item._id
        }));

        res.render("my-marketplace-items", {
            items: formattedItems
        });

    } catch (err) {
        console.log("MONGO MY MARKETPLACE ERROR:", err);
        res.render("error", {
            message: "Error fetching your items.",
            backLink: "/farmer/dashboard"
        });
    }
});

app.get("/farmer/post-marketplace-item",checkSubscription, (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }
    if (req.subscriptionExpired) {
    return res.render("message", {
        title: "Subscription Expired",
        message: "Renew subscription to post jobs.",
        backLink: "/farmer/renew-subscription"
    });
}

    res.render("post-marketplace-item");
});

app.get("/marketplace/item/:id", async (req, res) => {
    try {
        const item = await MarketplaceItem.findById(req.params.id)
            .populate("farmer_id", "full_name")
            .lean();

        if (!item) {
            return res.render("error", {
                message: "Marketplace item not found.",
                backLink: "/marketplace"
            });
        }

        res.render("marketplace-item-details", {
            item: {
                ...item,
                id: item._id,
                full_name: item.farmer_id?.full_name || "Farmer"
            }
        });

    } catch (err) {
        console.log("MONGO MARKETPLACE DETAILS ERROR:", err);
        res.render("error", {
            message: "Error fetching item details.",
            backLink: "/marketplace"
        });
    }
});

app.post("/farmer/post-marketplace-item", checkSubscription, async (req, res) => {
    try {
        if (req.subscriptionExpired) {
            return res.render("message", {
                title: "Subscription Expired",
                message: "Renew subscription to post items.",
                backLink: "/farmer/renew-subscription"
            });
        }

        if (!req.session.farmer) {
            return res.redirect("/farmer/login");
        }

        await MarketplaceItem.create({
            farmer_id: req.session.farmer.id,
            item_title: req.body.item_title,
            category: req.body.category,
            item_type: req.body.item_type,
            description: req.body.description,
            price: Number(req.body.price),
            location: req.body.location,
            contact_phone: req.body.contact_phone,
            image_url: req.body.image_url
        });

        res.render("message", {
            title: "Item Posted",
            message: "Your marketplace item has been posted successfully.",
            backLink: "/marketplace"
        });

    } catch (err) {
        console.log("MONGO POST MARKETPLACE ERROR:", err);
        res.render("error", {
            message: "Error posting marketplace item.",
            backLink: "/farmer/post-marketplace-item"
        });
    }
});

app.post("/farmer/delete-marketplace-item/:id", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) return res.redirect("/farmer/login");

        await MarketplaceItem.deleteOne({
            _id: req.params.id,
            farmer_id: req.session.farmer.id
        });

        res.redirect("/farmer/my-marketplace-items");

    } catch (err) {
        console.log("MONGO DELETE MARKETPLACE ERROR:", err);
        res.render("error", {
            message: "Error deleting item.",
            backLink: "/farmer/my-marketplace-items"
        });
    }
});

app.get("/farmer/edit-marketplace-item/:id", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) {
            return res.redirect("/farmer/login");
        }

        const item = await MarketplaceItem.findOne({
            _id: req.params.id,
            farmer_id: req.session.farmer.id
        }).lean();

        if (!item) {
            return res.render("error", {
                message: "Item not found or unauthorized access.",
                backLink: "/farmer/my-marketplace-items"
            });
        }

        res.render("edit-marketplace-item", {
            item: {
                ...item,
                id: item._id
            }
        });

    } catch (err) {
        console.log("MONGO EDIT MARKETPLACE GET ERROR:", err);

        res.render("error", {
            message: "Error fetching marketplace item.",
            backLink: "/farmer/my-marketplace-items"
        });
    }
});

app.post("/farmer/edit-marketplace-item/:id", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) {
            return res.redirect("/farmer/login");
        }

        await MarketplaceItem.findOneAndUpdate(
            {
                _id: req.params.id,
                farmer_id: req.session.farmer.id
            },
            {
                item_title: req.body.item_title,
                category: req.body.category,
                item_type: req.body.item_type,
                description: req.body.description,
                price: Number(req.body.price),
                location: req.body.location,
                contact_phone: req.body.contact_phone,
                image_url: req.body.image_url
            }
        );

        res.render("message", {
            title: "Item Updated",
            message: "Marketplace item updated successfully.",
            backLink: "/farmer/my-marketplace-items"
        });

    } catch (err) {
        console.log("MONGO EDIT MARKETPLACE POST ERROR:", err);

        res.render("error", {
            message: "Error updating marketplace item.",
            backLink: "/farmer/my-marketplace-items"
        });
    }
});

app.post("/farmer/mark-marketplace-item/:id", checkSubscription, async (req, res) => {
    try {
        if (!req.session.farmer) {
            return res.redirect("/farmer/login");
        }

        await MarketplaceItem.findOneAndUpdate(
            {
                _id: req.params.id,
                farmer_id: req.session.farmer.id
            },
            {
                status: req.body.status
            }
        );

        res.redirect("/farmer/my-marketplace-items");

    } catch (err) {
        console.log("MONGO MARKETPLACE STATUS ERROR:", err);

        res.render("error", {
            message: "Error updating item status.",
            backLink: "/farmer/my-marketplace-items"
        });
    }
});

app.get("/farmer/renew-subscription", (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    res.render("farmer-renew-subscription");
});

app.post("/farmer/renew-subscription", async (req, res) => {
    try {
        if (!req.session.farmer) {
            return res.redirect("/farmer/login");
        }

        const currentLang = req.query.lang || "en";
        const { subscription_plan } = req.body;

        if (!subscription_plan) {
            return res.render("error", {
                message: "Please select a subscription plan.",
                backLink: `/farmer/renew-subscription?lang=${currentLang}`
            });
        }

        const [amount, months] = subscription_plan.split("|");
        const paymentSessionId = crypto.randomBytes(16).toString("hex");
        const order = await createRazorpayOrder(amount, `farmer_renew_${Date.now()}`);

        paymentSessions[paymentSessionId] = {
            type: "farmer_renewal",
            orderId: order.id,
            amount,
            farmerId: req.session.farmer.id,
            data: {
                subscription_amount: amount,
                subscription_months: months,
                subscription_plan_label: `₹${amount} - ${months} Months`,
                currentLang
            }
        };

        res.render("razorpay-payment", {
            title: "Renew Subscription",
            amount,
            order,
            paymentSessionId,
            keyId: process.env.RAZORPAY_KEY_ID,
            currentLang,
            cancelLink: "/farmer/renew-subscription",
            customerName: req.session.farmer.full_name,
            customerEmail: req.session.farmer.email,
            customerPhone: req.session.farmer.phone
        });

    } catch (err) {
        console.log("RENEW PAYMENT ERROR:", err);
        res.render("error", {
            message: "Unable to start renewal payment.",
            backLink: "/farmer/renew-subscription"
        });
    }
});

app.get("/krishi-yojanas", (req, res) => {
    const currentLang = req.query.lang || "en";
    const selectedCategory = req.query.category || "All";
    const search = (req.query.search || "").toLowerCase().trim();

    const yojanas = [
        {
            title: "PM-KISAN",
            category: "Subsidy",
            description: "Income support scheme for eligible landholding farmer families.",
            benefits: "₹6000 per year in three instalments.",
            eligibility: "Eligible landholding farmer families as per scheme rules.",
            link: "https://www.myscheme.gov.in/schemes/pm-kisan"
        },
        {
            title: "Kisan Credit Card (KCC)",
            category: "Loan",
            description: "Provides timely and flexible crop loan support through banks.",
            benefits: "Short-term credit for crop and related needs.",
            eligibility: "Farmers who meet KCC banking and scheme requirements.",
            link: "https://www.myscheme.gov.in/schemes/kcc"
        },
        {
            title: "PM-KUSUM",
            category: "Energy",
            description: "Supports solar-based energy solutions for farmers.",
            benefits: "Helps reduce irrigation and energy costs through solar support.",
            eligibility: "Farmers and eligible entities as per PM-KUSUM guidelines.",
            link: "https://www.myscheme.gov.in/schemes/pm-kusum"
        },
        {
            title: "PMKSY - Per Drop More Crop",
            category: "Irrigation",
            description: "Focuses on micro-irrigation and better water-use efficiency.",
            benefits: "Support for drip and sprinkler irrigation systems.",
            eligibility: "Eligible farmers under PMKSY micro-irrigation rules.",
            link: "https://www.myscheme.gov.in/schemes/pmksypdmc"
        },
        {
            title: "Pradhan Mantri Kisan Maandhan Yojana",
            category: "Pension",
            description: "Old-age social security scheme for small and marginal farmers.",
            benefits: "₹3000 monthly pension after 60 years of age.",
            eligibility: "Eligible small and marginal farmers under the scheme rules.",
            link: "https://www.myscheme.gov.in/schemes/pmkmdy"
        },
        {
            title: "PM Fasal Bima Yojana (PMFBY)",
            category: "Insurance",
            description: "Crop insurance scheme for farmers.",
            benefits: "Protection against crop loss due to natural disasters.",
            eligibility: "All farmers growing notified crops.",
            link: "https://pmfby.gov.in/"
        },
        {
            title: "PM AASHA",
            category: "Market",
            description: "Ensures farmers get minimum support price.",
            benefits: "Government buys crops if price falls.",
            eligibility: "Farmers producing MSP crops.",
            link: "https://agricoop.nic.in/"
        },
        {
            title: "Agriculture Infrastructure Fund",
            category: "Infrastructure",
            description: "Supports building farm infrastructure.",
            benefits: "Subsidized loans for warehouses, storage.",
            eligibility: "Farmers, FPOs, agri-startups.",
            link: "https://agriinfra.dac.gov.in/"
        },
        {
            title: "e-NAM",
            category: "Market",
            description: "Online agricultural market platform.",
            benefits: "Better price discovery for crops.",
            eligibility: "All registered farmers.",
            link: "https://enam.gov.in/"
        },
        {
            title: "Soil Health Card Scheme",
            category: "Subsidy",
            description: "Provides soil quality reports.",
            benefits: "Helps use correct fertilizers.",
            eligibility: "All farmers.",
            link: "https://soilhealth.dac.gov.in/"
        },
        {
            title: "PKVY (Organic Farming)",
            category: "Organic",
            description: "Promotes organic farming.",
            benefits: "Support for organic inputs.",
            eligibility: "Farmers interested in organic farming.",
            link: "https://pgsindia-ncof.gov.in/"
        },
        {
            title: "NMSA",
            category: "Subsidy",
            description: "Sustainable agriculture scheme.",
            benefits: "Water and soil conservation.",
            eligibility: "Farmers in climate-risk areas.",
            link: "https://nmsa.dac.gov.in/"
        },
        {
            title: "Micro Irrigation Fund",
            category: "Irrigation",
            description: "Supports drip irrigation systems.",
            benefits: "Water saving technology.",
            eligibility: "Farmers adopting irrigation systems.",
            link: "https://nabard.org/"
        },
        {
            title: "National Food Security Mission (NFSM)",
            category: "Subsidy",
            description: "Increase production of rice, wheat, pulses.",
            benefits: "Improves crop productivity.",
            eligibility: "Farmers growing food crops.",
            link: "https://nfsm.gov.in/"
        },
        {
            title: "Rashtriya Krishi Vikas Yojana (RKVY)",
            category: "Subsidy",
            description: "Supports agriculture development projects.",
            benefits: "Funding for agri projects and startups.",
            eligibility: "Farmers, agri-entrepreneurs.",
            link: "https://rkvy.nic.in/"
        },
        {
            title: "NMOOP",
            category: "Subsidy",
            description: "Promotes oilseed and oil palm farming.",
            benefits: "Subsidy for seeds and farming.",
            eligibility: "Farmers growing oil crops.",
            link: "https://agricoop.nic.in/"
        },
        {
            title: "SMAM",
            category: "Subsidy",
            description: "Supports farm machinery purchase.",
            benefits: "Subsidy on tractors and equipment.",
            eligibility: "Small and marginal farmers.",
            link: "https://agricoop.nic.in/"
        },
        {
            title: "ISAM",
            category: "Market",
            description: "Improves agricultural marketing infrastructure.",
            benefits: "Better storage and marketing facilities.",
            eligibility: "Farmers, traders.",
            link: "https://agmarknet.gov.in/"
        },
        {
            title: "MIDH",
            category: "Subsidy",
            description: "Promotes horticulture crops.",
            benefits: "Support for fruits, vegetables, flowers.",
            eligibility: "Farmers doing horticulture.",
            link: "https://midh.gov.in/"
        },
        {
            title: "National Bamboo Mission",
            category: "Subsidy",
            description: "Promotes bamboo cultivation.",
            benefits: "Financial support for bamboo farming.",
            eligibility: "Farmers interested in bamboo.",
            link: "https://nbm.nic.in/"
        },
        {
            title: "Blue Revolution",
            category: "Livestock",
            description: "Supports fisheries development.",
            benefits: "Boost fish production income.",
            eligibility: "Fish farmers.",
            link: "https://nfdb.gov.in/"
        },
        {
            title: "DEDS",
            category: "Livestock",
            description: "Supports dairy farming.",
            benefits: "Subsidy for dairy units.",
            eligibility: "Farmers and dairy entrepreneurs.",
            link: "https://nabard.org/"
        },
        {
            title: "National Livestock Mission",
            category: "Livestock",
            description: "Supports livestock farming.",
            benefits: "Improves animal productivity.",
            eligibility: "Farmers with livestock.",
            link: "https://nlm.udyamimitra.in/"
        },
        {
            title: "Atmanirbhar Bharat Agri Infra",
            category: "Infrastructure",
            description: "Boost agriculture infrastructure.",
            benefits: "Financial support for infra projects.",
            eligibility: "Farmers, startups.",
            link: "https://agriinfra.dac.gov.in/"
        },
        {
            title: "Kisan Rail",
            category: "Market",
            description: "Transport agricultural produce.",
            benefits: "Faster delivery to markets.",
            eligibility: "Farmers and traders.",
            link: "https://indianrailways.gov.in/"
        },
        {
            title: "Gramin Bhandaran Yojana",
            category: "Infrastructure",
            description: "Supports rural warehouses.",
            benefits: "Storage subsidy.",
            eligibility: "Farmers, cooperatives.",
            link: "https://nabard.org/"
        },
        {
            title: "National Beekeeping Scheme",
            category: "Livestock",
            description: "Promotes honey production.",
            benefits: "Extra income source.",
            eligibility: "Farmers and entrepreneurs.",
            link: "https://nbb.gov.in/"
        },
        {
            title: "PMFME",
            category: "Infrastructure",
            description: "Supports food processing businesses.",
            benefits: "Subsidy for small food industries.",
            eligibility: "Farmers, SHGs, entrepreneurs.",
            link: "https://pmfme.mofpi.gov.in/"
        }
    ];

    const filteredYojanas =
        selectedCategory === "All"
            ? yojanas
            : yojanas.filter(item => item.category === selectedCategory);

    res.render("krishi-yojanas", {
    currentLang,
    yojanas: filteredYojanas,
    selectedCategory,
    search
});
});

app.post("/razorpay/verify", async (req, res) => {
    try {
        const {
            paymentSessionId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const sessionData = paymentSessions[paymentSessionId];

        if (!sessionData) {
            return res.render("error", {
                message: "Invalid payment session.",
                backLink: "/"
            });
        }

        if (sessionData.orderId !== razorpay_order_id) {
            return res.render("error", {
                message: "Order mismatch. Payment verification failed.",
                backLink: "/"
            });
        }

        const isValid = verifyRazorpaySignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            return res.render("error", {
                message: "Payment signature verification failed.",
                backLink: "/"
            });
        }

        const data = sessionData.data;

        if (sessionData.type === "farmer_register") {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + parseInt(data.subscription_months));

    try {
        await Farmer.create({
            full_name: data.full_name,
            phone: data.phone,
            village: data.village,
            email: data.email,
            password: hashedPassword,
            subscription_plan: data.subscription_plan_label,
            subscription_amount: Number(data.subscription_amount),
            subscription_months: Number(data.subscription_months),
            subscription_status: "Paid",
            subscription_start_date: startDate,
            subscription_end_date: endDate
        });

        delete paymentSessions[paymentSessionId];

        return res.render("message", {
            title: "Payment Successful",
            message: "Farmer account created successfully.",
            backLink: "/farmer/login"
        });

    } catch (err) {
        console.log("MONGO FARMER REGISTER ERROR:", err);

        return res.render("error", {
            message: "Payment successful, but farmer account creation failed.",
            backLink: "/farmer/register"
        });
    }
}

        if (sessionData.type === "farmer_renewal") {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + parseInt(data.subscription_months));

    try {
        await Farmer.findByIdAndUpdate(sessionData.farmerId, {
            subscription_plan: data.subscription_plan_label,
            subscription_amount: Number(data.subscription_amount),
            subscription_months: Number(data.subscription_months),
            subscription_status: "Paid",
            subscription_start_date: startDate,
            subscription_end_date: endDate
        });

        if (req.session.farmer) {
            req.session.farmer.subscription_plan = data.subscription_plan_label;
            req.session.farmer.subscription_amount = Number(data.subscription_amount);
            req.session.farmer.subscription_months = Number(data.subscription_months);
            req.session.farmer.subscription_status = "Paid";
            req.session.farmer.subscription_start_date = startDate;
            req.session.farmer.subscription_end_date = endDate;
        }

        delete paymentSessions[paymentSessionId];

        return res.render("message", {
            title: "Subscription Renewed",
            message: "Your subscription has been renewed successfully.",
            backLink: "/farmer/dashboard"
        });

    } catch (err) {
        console.log("MONGO FARMER RENEWAL ERROR:", err);

        return res.render("error", {
            message: "Payment successful, but renewal failed.",
            backLink: "/farmer/renew-subscription"
        });
    }
}
        if (sessionData.type === "worker_register") {
    try {
        const hashedPassword = await bcrypt.hash(data.password, 10);

        await Worker.create({
            full_name: data.full_name,
            phone: data.phone,
            email: data.email,
            password: hashedPassword,
            skill_category: Array.isArray(data.skill_category)
                ? data.skill_category
                : data.skill_category.split(",").map(s => s.trim()),
            experience_level: data.experience_level,
            village: data.village
        });

        delete paymentSessions[paymentSessionId];

        return res.render("message", {
            title: "Worker Registered",
            message: "Payment successful. Worker account created successfully.",
            backLink: "/worker/login"
        });

    } catch (err) {
        console.log("MONGO WORKER REGISTER ERROR:", err);

        return res.render("error", {
            message: "Payment successful, but worker registration failed.",
            backLink: "/worker/register"
        });
    }
}

        if (sessionData.type === "job_post") {
    try {
        await Job.create({
            farmer_id: sessionData.farmerId,
            job_title: data.job_title,
            category: data.category,
            work_type: data.work_type,
            description: data.description || "",
            location: data.location,
            wage: Number(data.wage),
            workers_required: Number(data.workers_required),
            payment_mode: data.payment_mode,
            start_date: data.start_date || null,
            end_date: data.end_date || null,
            status: "Open",
            version: 1
        });

        delete paymentSessions[paymentSessionId];

        return res.render("message", {
            title: "Job Posted",
            message: "Payment successful. Your job has been posted.",
            backLink: "/farmer/dashboard"
        });

    } catch (err) {
        console.log("MONGO JOB POST ERROR:", err);

        return res.render("error", {
            message: "Payment successful, but job posting failed.",
            backLink: "/farmer/post-job"
        });
    }
}

        return res.render("error", {
            message: "Unknown payment type.",
            backLink: "/"
        });

    } catch (err) {
        console.log("RAZORPAY VERIFY ERROR:", err);
        return res.render("error", {
            message: "Server error while verifying payment.",
            backLink: "/"
        });
    }
});


// Start server on all networks (important)
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on:`);
    console.log(`👉 Local:   http://localhost:${PORT}`);
});