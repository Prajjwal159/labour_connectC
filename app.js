const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const axios = require("axios");
require("dotenv").config();
const db = require("./config/db");
const translations = require("./locales/translations");
const os = require("os");
const crypto = require("crypto");

const fakePayments = {};

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

app.post("/farmer/login", (req, res) => {
    const { email, password } = req.body;

    const query = "SELECT * FROM farmers WHERE email = ?";

    db.query(query, [email], async (err, result) => {
        if (err) {
            console.log(err);
            return res.send("Database error during login.");
        }

        if (result.length === 0) {
            return res.render("error", {
                message: "Farmer account not found.",
                backLink: "/farmer/login"
            });
        }

        const farmer = result[0];

        const isMatch = await bcrypt.compare(password, farmer.password);

        if (!isMatch) {
            return res.render("error", {
                message: "Invalid password. Please try again.",
                backLink: "/farmer/login"
            });
        }

        req.session.farmer = {
            id: farmer.id,
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
    });
});

app.get("/worker/login", (req, res) => {
    res.render("worker-login");
});

app.post("/worker/login", (req, res) => {
    const { email, password } = req.body;

    const query = "SELECT * FROM workers WHERE email = ?";

    db.query(query, [email], async (err, result) => {
        if (err) {
            console.log(err);
            return res.send("Database error during worker login.");
        }

        if (result.length === 0) {
            return res.render("error", {
                message: "Worker account not found.",
                backLink: "/worker/login"
            });
        }

        const worker = result[0];
        const isMatch = await bcrypt.compare(password, worker.password);

        if (!isMatch) {
            return res.render("error", {
                message: "Invalid password. Please try again.",
                backLink: "/worker/login"
            });
        }

        req.session.worker = {
            id: worker.id,
            full_name: worker.full_name,
            email: worker.email,
            phone: worker.phone,
            village: worker.village,
            skill_category: worker.skill_category,
            experience_level: worker.experience_level
        };

        res.redirect("/worker/dashboard");
    });
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

app.post("/farmer/register", (req, res) => {
    try {
        const { full_name, phone, village, email, password, subscription_plan } = req.body;
        const currentLang = req.query.lang || "en";

        if (!subscription_plan) {
            return res.send("Select subscription plan");
        }

        const [amount, months] = subscription_plan.split("|");

        const token = crypto.randomBytes(16).toString("hex");

        fakePayments[token] = {
            status: "pending",
            data: {
                full_name,
                phone,
                village,
                email,
                password,
                subscription_amount: amount,
                subscription_months: months,
                subscription_plan_label: `${amount} - ${months} months`,
                currentLang
            }
        };

        req.session.paymentToken = token;

        res.redirect(`/farmer/subscription-payment?lang=${currentLang}`);

    } catch (err) {
        console.log("REGISTER ERROR:", err);
        res.send("Error in register");
    }
});

app.get("/farmer/subscription-payment", (req, res) => {
    const token = req.session.paymentToken;
    const currentLang = req.query.lang || "en";

    if (!token || !fakePayments[token]) {
        return res.redirect(`/farmer/register?lang=${currentLang}`);
    }

    const farmerData = fakePayments[token].data;

    const laptopIp = "10.192.195.208"; // keep your IP

    const paymentUrl = `http://${laptopIp}:5000/farmer/demo-pay/${token}?lang=${currentLang}`;

    res.render("farmer-subscription-payment", {
        farmerData,
        paymentUrl,
        paymentToken: token,
        currentLang
    });
});

app.post("/farmer/confirm-payment", (req, res) => {
    try {
        const { token } = req.body;

        if (!token || !fakePayments[token]) {
            return res.render("error", {
                message: "Invalid payment session.",
                backLink: "/farmer/register"
            });
        }

        if (fakePayments[token].status !== "done") {
            return res.render("error", {
                message: "Payment not completed yet.",
                backLink: "/farmer/register"
            });
        }

        const data = fakePayments[token].data;

        if (fakePayments[token].type === "renewal") {
            const farmerId = fakePayments[token].farmerId;
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + parseInt(data.subscription_months));

            const updateQuery = `
                UPDATE farmers
                SET subscription_plan = ?,
                    subscription_amount = ?,
                    subscription_months = ?,
                    subscription_status = 'Paid',
                    subscription_start_date = ?,
                    subscription_end_date = ?
                WHERE id = ?
            `;

            db.query(
                updateQuery,
                [
                    data.subscription_plan_label,
                    parseFloat(data.subscription_amount),
                    parseInt(data.subscription_months),
                    startDate.toISOString().split("T")[0],
                    endDate.toISOString().split("T")[0],
                    farmerId
                ],
                (err) => {
                    if (err) {
                        console.log(err);
                        return res.render("error", {
                            message: "Error renewing subscription.",
                            backLink: "/farmer/renew-subscription"
                        });
                    }

                    req.session.farmer.subscription_plan = data.subscription_plan_label;
                    req.session.farmer.subscription_amount = parseFloat(data.subscription_amount);
                    req.session.farmer.subscription_months = parseInt(data.subscription_months);
                    req.session.farmer.subscription_status = "Paid";
                    req.session.farmer.subscription_start_date = startDate.toISOString().split("T")[0];
                    req.session.farmer.subscription_end_date = endDate.toISOString().split("T")[0];

                    delete fakePayments[token];

                    return res.render("message", {
                        title: "Subscription Renewed",
                        message: "Your subscription has been renewed successfully.",
                        backLink: "/farmer/dashboard"
                    });
                }
            );

            return;
        }

        const {
            full_name,
            phone,
            village,
            email,
            password,
            subscription_amount,
            subscription_months,
            subscription_plan_label
        } = data;

        bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
            if (hashErr) {
                console.log(hashErr);
                return res.render("error", {
                    message: "Error hashing password.",
                    backLink: "/farmer/register"
                });
            }

            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + parseInt(subscription_months));

            const insertQuery = `
                INSERT INTO farmers
                (
                    full_name,
                    phone,
                    village,
                    email,
                    password,
                    subscription_plan,
                    subscription_amount,
                    subscription_months,
                    subscription_status,
                    subscription_start_date,
                    subscription_end_date
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertQuery,
                [
                    full_name,
                    phone,
                    village,
                    email,
                    hashedPassword,
                    subscription_plan_label,
                    subscription_amount,
                    subscription_months,
                    "Paid",
                    startDate.toISOString().split("T")[0],
                    endDate.toISOString().split("T")[0]
                ],
                (err) => {
                    if (err) {
                        console.log(err);
                        return res.render("error", {
                            message: "DB error while creating farmer.",
                            backLink: "/farmer/register"
                        });
                    }

                    delete fakePayments[token];

                    return res.render("message", {
                        title: "Success",
                        message: "Payment done. Farmer account created.",
                        backLink: "/farmer/login"
                    });
                }
            );
        });

    } catch (error) {
        console.log(error);
        return res.render("error", {
            message: "Server error.",
            backLink: "/farmer/register"
        });
    }
});

app.get("/farmer/demo-pay/:token", (req, res) => {
    const token = req.params.token;
    const currentLang = req.query.lang || "en";

    if (!fakePayments[token]) {
        return res.render("error", {
            message: "Invalid payment link.",
            backLink: `/farmer/register?lang=${currentLang}`
        });
    }

    res.render("farmer-demo-pay", {
        token,
        currentLang
    });
});

app.post("/farmer/demo-pay/:token", (req, res) => {
    const token = req.params.token;
    const currentLang = req.query.lang || "en";

    if (!fakePayments[token]) {
        return res.render("error", {
            message: "Invalid payment link.",
            backLink: `/farmer/register?lang=${currentLang}`
        });
    }

    fakePayments[token].status = "done";

    return res.render("message", {
        title: "Payment Successful",
        message: "Demo payment completed successfully. Return to the laptop screen.",
        backLink: `/?lang=${currentLang}`
    });
});

app.get("/farmer/dashboard",checkSubscription, (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const farmer = req.session.farmer;

    const jobsQuery = `
        SELECT 
            jobs.*,
            COUNT(
                CASE 
                    WHEN job_applications.application_status IN ('Applied', 'Accepted') 
                    THEN 1 
                END
            ) AS applied_count
        FROM jobs
        LEFT JOIN job_applications
            ON jobs.id = job_applications.job_id
            AND job_applications.job_version = jobs.version
        WHERE jobs.farmer_id = ?
        GROUP BY jobs.id
        ORDER BY jobs.created_at DESC
    `;

    const marketplaceSummaryQuery = `
        SELECT
            COUNT(*) AS total_items,
            SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) AS available_items,
            SUM(CASE WHEN status = 'Sold' THEN 1 ELSE 0 END) AS sold_items
        FROM marketplace_items
        WHERE farmer_id = ?
    `;

    const recentMarketplaceItemsQuery = `
        SELECT *
        FROM marketplace_items
        WHERE farmer_id = ?
        ORDER BY created_at DESC
        LIMIT 4
    `;

    db.query(jobsQuery, [farmer.id], (jobsErr, jobs) => {
        if (jobsErr) {
            console.log("FARMER DASHBOARD JOBS ERROR:", jobsErr);
            return res.send("Error fetching farmer jobs.");
        }

        db.query(marketplaceSummaryQuery, [farmer.id], (marketErr, marketResults) => {
            if (marketErr) {
                console.log("FARMER DASHBOARD MARKETPLACE ERROR:", marketErr);
                return res.send("Error fetching marketplace summary.");
            }

            db.query(recentMarketplaceItemsQuery, [farmer.id], (recentErr, recentMarketplaceItems) => {
                if (recentErr) {
                    console.log("FARMER DASHBOARD RECENT MARKETPLACE ERROR:", recentErr);
                    return res.send("Error fetching recent marketplace items.");
                }

                const marketplaceSummary = marketResults[0] || {
                    total_items: 0,
                    available_items: 0,
                    sold_items: 0
                };

                const subscriptionWarning = getSubscriptionWarning(farmer.subscription_end_date);

                res.render("farmer-dashboard", {
                    farmer,
                    jobs,
                    marketplaceSummary,
                    recentMarketplaceItems,
                    subscriptionWarning,
                    subscriptionExpired: req.subscriptionExpired
                });
            });
        });
    });
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
        if (!skill_category || (Array.isArray(skill_category) && skill_category.length === 0)) {
            return res.render("error", {
                message: "Please select at least one skill.",
                backLink: "/worker/register"
            });
        }
        // if multiple selected, convert array to comma-separated string
        if (Array.isArray(skill_category)) {
            skill_category = skill_category.join(",");
        }
        const checkQuery = "SELECT * FROM workers WHERE email = ?";
        db.query(checkQuery, [email], async (err, result) => {
            if (err) {
                console.log(err);
                return res.send("Database error while checking worker.");
            }

            if (result.length > 0) {
                return res.send("Email already registered.");
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const insertQuery = `
                INSERT INTO workers (full_name, phone, email, password, skill_category, experience_level, village)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertQuery,
                [full_name, phone, email, hashedPassword, skill_category, experience_level, village],
                (err, data) => {
                    if (err) {
                        console.log(err);
                        return res.send("Error registering worker.");
                    }

                    res.redirect("/worker/login");
                }
            );
        });
    } catch (error) {
        console.log(error);
        res.send("Server error.");
    }
});

app.get("/worker/jobs", (req, res) => {
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

    const workerSkills = (req.session.worker.skill_category || "")
    .split(",")
    .map(skill => skill.trim())
    .filter(skill => skill !== "");

    let query = `
        SELECT 
            jobs.*,
            COUNT(
                CASE 
                    WHEN job_applications.application_status IN ('Applied', 'Accepted') 
                    THEN 1 
                END
            ) AS applied_count
        FROM jobs
        LEFT JOIN job_applications
            ON jobs.id = job_applications.job_id
            AND job_applications.job_version = jobs.version
        WHERE jobs.status = 'Open'
    `;

    const params = [];

    if (keyword) {
        query += " AND jobs.job_title LIKE ?";
        params.push(`%${keyword}%`);
    }

    if (location) {
        query += " AND jobs.location LIKE ?";
        params.push(`%${location}%`);
    }

    if (category) {
        query += " AND jobs.category = ?";
        params.push(category);
    }

    if (work_type) {
        query += " AND jobs.work_type = ?";
        params.push(work_type);
    }

    if (min_wage) {
        query += " AND jobs.wage >= ?";
        params.push(min_wage);
    }

    if (payment_mode) {
        query += " AND jobs.payment_mode = ?";
        params.push(payment_mode);
    }

    query += " GROUP BY jobs.id";

    if (sort === "highest_wage") {
        query += " ORDER BY jobs.wage DESC, jobs.created_at DESC";
    } else if (sort === "newest") {
        query += " ORDER BY jobs.created_at DESC";
    } else if (sort === "skill_match" && workerSkills.length > 0) {
        const placeholders = workerSkills.map(() => "?").join(",");
        query += ` ORDER BY (jobs.category IN (${placeholders})) DESC, jobs.created_at DESC`;
        params.push(...workerSkills);
    } else {
        query += " ORDER BY jobs.created_at DESC";
    }

    db.query(query, params, (err, results) => {
        if (err) {
            console.log("WORKER JOBS ERROR:", err);
            return res.send("Error fetching jobs.");
        }

        res.render("worker-jobs", {
            jobs: results,
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
    });
});

app.post("/worker/apply/:jobId", (req, res) => {
    if (!req.session.worker) {
        return res.redirect("/worker/login");
    }

    const worker_id = req.session.worker.id;
    const job_id = req.params.jobId;
    const currentLang = req.query.lang || "en";

    const jobQuery = "SELECT * FROM jobs WHERE id = ? AND status = 'Open'";

    db.query(jobQuery, [job_id], (jobErr, jobResult) => {
        if (jobErr) {
            console.log("JOB FETCH ERROR:", jobErr);
            return res.render("message", {
                title: "Application Error",
                message: "Could not fetch job details.",
                backLink: `/worker/jobs?lang=${currentLang}`
            });
        }

        if (jobResult.length === 0) {
            return res.render("message", {
                title: "Job Not Found",
                message: "This job is unavailable or no longer open.",
                backLink: `/worker/jobs?lang=${currentLang}`
            });
        }

        const job = jobResult[0];
        const currentVersion = job.version || 1;

        const countQuery = `
            SELECT COUNT(*) AS total_applied
            FROM job_applications
            WHERE job_id = ?
              AND job_version = ?
              AND application_status IN ('Applied', 'Accepted')
        `;

        db.query(countQuery, [job_id, currentVersion], (countErr, countResult) => {
            if (countErr) {
                console.log("COUNT ERROR:", countErr);
                return res.render("message", {
                    title: "Application Error",
                    message: "Could not check current application count.",
                    backLink: `/worker/jobs?lang=${currentLang}`
                });
            }

            const totalApplied = countResult[0].total_applied || 0;

            if (totalApplied >= job.workers_required) {
                const closeQuery = "UPDATE jobs SET status = 'Closed' WHERE id = ?";

                db.query(closeQuery, [job_id], (closeErr) => {
                    if (closeErr) {
                        console.log("AUTO CLOSE ERROR:", closeErr);
                    }

                    return res.render("message", {
                        title: "Job Full",
                        message: "This job has already reached the required number of workers and is now closed.",
                        backLink: `/worker/jobs?lang=${currentLang}`
                    });
                });
                return;
            }

            const checkQuery = `
                SELECT * FROM job_applications
                WHERE job_id = ? AND worker_id = ? AND job_version = ?
            `;

            db.query(checkQuery, [job_id, worker_id, currentVersion], (err, result) => {
                if (err) {
                    console.log("CHECK APPLY ERROR:", err);
                    return res.render("message", {
                        title: "Application Error",
                        message: "There was a problem while checking your application.",
                        backLink: `/worker/jobs?lang=${currentLang}`
                    });
                }

                if (result.length > 0) {
                    return res.render("message", {
                        title: "Already Applied",
                        message: "You have already applied for the current version of this job.",
                        backLink: `/worker/jobs?lang=${currentLang}`
                    });
                }

                const insertQuery = `
                    INSERT INTO job_applications (job_id, worker_id, job_version)
                    VALUES (?, ?, ?)
                `;

                db.query(insertQuery, [job_id, worker_id, currentVersion], (insertErr) => {
                    if (insertErr) {
                        console.log("INSERT APPLY ERROR:", insertErr);
                        return res.render("message", {
                            title: "Application Error",
                            message: "There was a problem while applying for the job.",
                            backLink: `/worker/jobs?lang=${currentLang}`
                        });
                    }

                    const recountQuery = `
                        SELECT COUNT(*) AS total_applied
                        FROM job_applications
                        WHERE job_id = ?
                          AND job_version = ?
                          AND application_status IN ('Applied', 'Accepted')
                    `;

                    db.query(recountQuery, [job_id, currentVersion], (recountErr, recountResult) => {
                        if (recountErr) {
                            console.log("RECOUNT ERROR:", recountErr);
                            return res.render("message", {
                                title: "Application Submitted",
                                message: "You have successfully applied for this job.",
                                backLink: `/worker/jobs?lang=${currentLang}`
                            });
                        }

                        const updatedApplied = recountResult[0].total_applied || 0;

                        if (updatedApplied >= job.workers_required) {
                            const closeQuery = "UPDATE jobs SET status = 'Closed' WHERE id = ?";

                            db.query(closeQuery, [job_id], (closeErr) => {
                                if (closeErr) {
                                    console.log("FINAL AUTO CLOSE ERROR:", closeErr);
                                }

                                return res.render("message", {
                                    title: "Application Submitted",
                                    message: `You have successfully applied. This job has now reached ${updatedApplied}/${job.workers_required} workers and has been closed automatically.`,
                                    backLink: `/worker/jobs?lang=${currentLang}`
                                });
                            });
                        } else {
                            return res.render("message", {
                                title: "Application Submitted",
                                message: `You have successfully applied for this job. Current filled workers: ${updatedApplied}/${job.workers_required}.`,
                                backLink: `/worker/jobs?lang=${currentLang}`
                            });
                        }
                    });
                });
            });
        });
    });
});

app.get("/farmer/job-applications/:jobId", checkSubscription, (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const jobId = req.params.jobId;
    const farmerId = req.session.farmer.id;

    const jobQuery = "SELECT * FROM jobs WHERE id = ? AND farmer_id = ?";

    db.query(jobQuery, [jobId, farmerId], (err, jobResults) => {
        if (err) {
            console.log(err);
            return res.render("error", {
                message: "Error fetching job details.",
                backLink: "/farmer/renew-subscription"
            });
        }

        if (jobResults.length === 0) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        const job = jobResults[0];

        const appQuery = `
            SELECT 
                job_applications.id,
                job_applications.application_status,
                job_applications.job_version,
                job_applications.applied_at,
                workers.full_name,
                workers.email,
                workers.phone,
                workers.village,
                workers.skill_category,
                workers.experience_level
            FROM job_applications
            JOIN workers ON job_applications.worker_id = workers.id
            WHERE job_applications.job_id = ?
            ORDER BY job_applications.job_version DESC, job_applications.applied_at DESC
        `;

        db.query(appQuery, [jobId], (appErr, applications) => {
            if (appErr) {
                console.log(appErr);
                return res.render("error", {
                    message: "Error fetching applications.",
                    backLink: "/farmer/dashboard"
                });
            }

            const groupedApplications = {};

            applications.forEach((app) => {
                const version = app.job_version || 1;
                if (!groupedApplications[version]) {
                    groupedApplications[version] = [];
                }
                groupedApplications[version].push(app);
            });

            res.render("job-applications", {
                job,
                groupedApplications
            });
        });
    });
});

app.post("/farmer/application/update/:appId", checkSubscription,(req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const appId = req.params.appId;
    const { status, jobId } = req.body;

    const query = "UPDATE job_applications SET application_status = ? WHERE id = ?";

    db.query(query, [status, appId], (err, result) => {
        if (err) {
            console.log(err);
            return res.send("Error updating application.");
        }

        res.redirect(`/farmer/job-applications/${jobId}`);
    });
});

app.get("/worker/my-applications", (req, res) => {
    if (!req.session.worker) {
        return res.redirect("/worker/login");
    }

    const workerId = req.session.worker.id;

    const query = `
        SELECT 
            job_applications.application_status,
            job_applications.job_version,
            jobs.job_title,
            jobs.category,
            jobs.location,
            jobs.wage,
            jobs.id AS job_id,
            jobs.version AS current_job_version
        FROM job_applications
        JOIN jobs ON job_applications.job_id = jobs.id
        WHERE job_applications.worker_id = ?
        ORDER BY job_applications.applied_at DESC
    `;

    db.query(query, [workerId], (err, results) => {
        if (err) {
            console.log(err);
            return res.send("Error fetching applications.");
        }

        res.render("worker-applications", { applications: results });
    });
});

app.get("/farmer/forgot-password", (req, res) => {
    res.render("farmer-forgot-password");
});

app.post("/farmer/forgot-password", async (req, res) => {
    try {
        const { email, phone, newPassword } = req.body;

        const query = "SELECT * FROM farmers WHERE email = ? AND phone = ?";
        db.query(query, [email, phone], async (err, result) => {
            if (err) {
                console.log(err);
                return res.render("error", {
                    message: "Error while verifying farmer details.",
                    backLink: "/farmer/forgot-password"
                });
            }

            if (result.length === 0) {
                return res.render("error", {
                    message: "Farmer account not found with given email and phone.",
                    backLink: "/farmer/forgot-password"
                });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            const updateQuery = "UPDATE farmers SET password = ? WHERE email = ? AND phone = ?";
            db.query(updateQuery, [hashedPassword, email, phone], (err, data) => {
                if (err) {
                    console.log(err);
                    return res.render("error", {
                        message: "Error updating password.",
                        backLink: "/farmer/forgot-password"
                    });
                }

                return res.render("message", {
                    title: "Password Updated",
                    message: "Your farmer password has been updated successfully.",
                    backLink: "/farmer/login"
                });
            });
        });
    } catch (error) {
        console.log(error);
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

        const query = "SELECT * FROM workers WHERE email = ? AND phone = ?";
        db.query(query, [email, phone], async (err, result) => {
            if (err) {
                console.log(err);
                return res.render("error", {
                    message: "Error while verifying worker details.",
                    backLink: "/worker/forgot-password"
                });
            }

            if (result.length === 0) {
                return res.render("error", {
                    message: "Worker account not found with given email and phone.",
                    backLink: "/worker/forgot-password"
                });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            const updateQuery = "UPDATE workers SET password = ? WHERE email = ? AND phone = ?";
            db.query(updateQuery, [hashedPassword, email, phone], (err, data) => {
                if (err) {
                    console.log(err);
                    return res.render("error", {
                        message: "Error updating password.",
                        backLink: "/worker/forgot-password"
                    });
                }

                return res.render("message", {
                    title: "Password Updated",
                    message: "Your worker password has been updated successfully.",
                    backLink: "/worker/login"
                });
            });
        });
    } catch (error) {
        console.log(error);
        return res.render("error", {
            message: "Server error.",
            backLink: "/worker/forgot-password"
        });
    }
});

app.get("/farmer/edit-job/:jobId", checkSubscription, (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const jobId = req.params.jobId;
    const farmerId = req.session.farmer.id;

    const query = "SELECT * FROM jobs WHERE id = ? AND farmer_id = ?";

    db.query(query, [jobId, farmerId], (err, results) => {
        if (err) {
            console.log(err);
            return res.render("error", {
                message: "Error fetching job details.",
                backLink: "/farmer/dashboard"
            });
        }

        if (results.length === 0) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        return res.render("edit-job", { job: results[0] });
    });
});

app.post("/farmer/edit-job/:jobId", checkSubscription, (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const jobId = req.params.jobId;
    const farmerId = req.session.farmer.id;

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

    const getVersionQuery = "SELECT version FROM jobs WHERE id = ? AND farmer_id = ?";

    db.query(getVersionQuery, [jobId, farmerId], (versionErr, versionResult) => {
        if (versionErr) {
            console.log("GET VERSION ERROR:", versionErr);
            return res.render("error", {
                message: "Error fetching current job version.",
                backLink: `/farmer/edit-job/${jobId}`
            });
        }

        if (versionResult.length === 0) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        const currentVersion = versionResult[0].version || 1;
        const newVersion = currentVersion + 1;

        const updateJobQuery = `
            UPDATE jobs
            SET job_title = ?,
                category = ?,
                work_type = ?,
                description = ?,
                location = ?,
                wage = ?,
                workers_required = ?,
                payment_mode = ?,
                start_date = ?,
                end_date = ?,
                version = ?
            WHERE id = ? AND farmer_id = ?
        `;

        db.query(
            updateJobQuery,
            [
                job_title,
                category,
                work_type,
                description,
                location,
                wage,
                workers_required,
                payment_mode,
                start_date || null,
                end_date || null,
                newVersion,
                jobId,
                farmerId
            ],
            (err, result) => {
                if (err) {
                    console.log("UPDATE JOB ERROR:", err);
                    return res.render("error", {
                        message: "Error updating job.",
                        backLink: `/farmer/edit-job/${jobId}`
                    });
                }

                const insertVersionQuery = `
                    INSERT INTO job_versions
                    (job_id, version, job_title, category, work_type, description, location, wage, workers_required, payment_mode, start_date, end_date, restored_from_version)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                `;

                db.query(
                    insertVersionQuery,
                    [
                        jobId,
                        newVersion,
                        job_title,
                        category,
                        work_type,
                        description,
                        location,
                        wage,
                        workers_required,
                        payment_mode,
                        start_date || null,
                        end_date || null
                    ],
                    (historyErr, historyResult) => {
                        if (historyErr) {
                            console.log("INSERT VERSION ERROR:", historyErr);
                            return res.render("error", {
                                message: "Job updated, but version history could not be saved.",
                                backLink: "/farmer/dashboard"
                            });
                        }

                        return res.render("message", {
                            title: "Job Updated",
                            message: `Your job details were updated successfully. This job is now on version ${newVersion}.`,
                            backLink: "/farmer/dashboard"
                        });
                    }
                );
            }
        );
    });
});

app.get("/farmer/job-history/:jobId",checkSubscription, (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const jobId = req.params.jobId;
    const farmerId = req.session.farmer.id;

    const jobQuery = "SELECT * FROM jobs WHERE id = ? AND farmer_id = ?";

    db.query(jobQuery, [jobId, farmerId], (jobErr, jobResults) => {
        if (jobErr) {
            console.log(jobErr);
            return res.render("error", {
                message: "Error fetching job history.",
                backLink: "/farmer/dashboard"
            });
        }

        if (jobResults.length === 0) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        const job = jobResults[0];

        const historyQuery = `
            SELECT *
            FROM job_versions
            WHERE job_id = ?
            ORDER BY version DESC
        `;

        db.query(historyQuery, [jobId], (historyErr, historyResults) => {
            if (historyErr) {
                console.log(historyErr);
                return res.render("error", {
                    message: "Error fetching version history.",
                    backLink: "/farmer/dashboard"
                });
            }

            res.render("job-history", {
                job,
                versions: historyResults
            });
        });
    });
});

app.post("/farmer/restore-job-version/:jobId/:version", (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const jobId = req.params.jobId;
    const restoreVersion = parseInt(req.params.version, 10);
    const farmerId = req.session.farmer.id;

    const jobQuery = "SELECT * FROM jobs WHERE id = ? AND farmer_id = ?";

    db.query(jobQuery, [jobId, farmerId], (jobErr, jobResults) => {
        if (jobErr) {
            console.log(jobErr);
            return res.render("error", {
                message: "Error fetching current job.",
                backLink: `/farmer/job-history/${jobId}`
            });
        }

        if (jobResults.length === 0) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        const currentJob = jobResults[0];
        const newVersion = (currentJob.version || 1) + 1;

        const historyQuery = `
            SELECT *
            FROM job_versions
            WHERE job_id = ? AND version = ?
        `;

        db.query(historyQuery, [jobId, restoreVersion], (historyErr, historyResults) => {
            if (historyErr) {
                console.log(historyErr);
                return res.render("error", {
                    message: "Error fetching version to restore.",
                    backLink: `/farmer/job-history/${jobId}`
                });
            }

            if (historyResults.length === 0) {
                return res.render("error", {
                    message: "Selected version not found.",
                    backLink: `/farmer/job-history/${jobId}`
                });
            }

            const versionData = historyResults[0];

            const updateJobQuery = `
                UPDATE jobs
                SET job_title = ?, category = ?, work_type = ?, description = ?, location = ?, wage = ?, payment_mode = ?, start_date = ?, end_date = ?, version = ?
                WHERE id = ? AND farmer_id = ?
            `;

            db.query(
                updateJobQuery,
                [
                    versionData.job_title,
                    versionData.category,
                    versionData.work_type,
                    versionData.description,
                    versionData.location,
                    versionData.wage,
                    versionData.payment_mode,
                    versionData.start_date,
                    versionData.end_date,
                    newVersion,
                    jobId,
                    farmerId
                ],
                (updateErr, updateResult) => {
                    if (updateErr) {
                        console.log(updateErr);
                        return res.render("error", {
                            message: "Error restoring selected version.",
                            backLink: `/farmer/job-history/${jobId}`
                        });
                    }

                    const saveRestoredVersionQuery = `
                        INSERT INTO job_versions
                        (job_id, version, job_title, category, work_type, description, location, wage, payment_mode, start_date, end_date)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(
                        saveRestoredVersionQuery,
                        [
                            jobId,
                            newVersion,
                            versionData.job_title,
                            versionData.category,
                            versionData.work_type,
                            versionData.description,
                            versionData.location,
                            versionData.wage,
                            versionData.payment_mode,
                            versionData.start_date,
                            versionData.end_date
                        ],
                        (saveErr, saveResult) => {
                            if (saveErr) {
                                console.log(saveErr);
                                return res.render("error", {
                                    message: "Job was restored, but history could not be saved.",
                                    backLink: `/farmer/job-history/${jobId}`
                                });
                            }

                            return res.render("message", {
                                title: "Version Restored",
                                message: `Version ${restoreVersion} was restored successfully. The job is now live as version ${newVersion}.`,
                                backLink: `/farmer/job-history/${jobId}`
                            });
                        }
                    );
                }
            );
        });
    });
});

app.post("/farmer/delete-job/:jobId", checkSubscription, (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const jobId = req.params.jobId;
    const farmerId = req.session.farmer.id;

    const checkQuery = "SELECT * FROM jobs WHERE id = ? AND farmer_id = ?";

    db.query(checkQuery, [jobId, farmerId], (checkErr, checkResult) => {
        if (checkErr) {
            console.log(checkErr);
            return res.render("error", {
                message: "Error checking job before deletion.",
                backLink: "/farmer/dashboard"
            });
        }

        if (checkResult.length === 0) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        const deleteVersionsQuery = "DELETE FROM job_versions WHERE job_id = ?";

        db.query(deleteVersionsQuery, [jobId], (versionErr, versionResult) => {
            if (versionErr) {
                console.log(versionErr);
                return res.render("error", {
                    message: "Error deleting job version history.",
                    backLink: "/farmer/dashboard"
                });
            }

            const deleteApplicationsQuery = "DELETE FROM job_applications WHERE job_id = ?";

            db.query(deleteApplicationsQuery, [jobId], (appErr, appResult) => {
                if (appErr) {
                    console.log(appErr);
                    return res.render("error", {
                        message: "Error deleting job applications.",
                        backLink: "/farmer/dashboard"
                    });
                }

                const deleteJobQuery = "DELETE FROM jobs WHERE id = ? AND farmer_id = ?";

                db.query(deleteJobQuery, [jobId, farmerId], (deleteErr, deleteResult) => {
                    if (deleteErr) {
                        console.log(deleteErr);
                        return res.render("error", {
                            message: "Error deleting job.",
                            backLink: "/farmer/dashboard"
                        });
                    }

                    return res.render("message", {
                        title: "Job Deleted",
                        message: "The job was deleted successfully. It will no longer appear for workers.",
                        backLink: "/farmer/dashboard"
                    });
                });
            });
        });
    });
});

app.post("/farmer/close-job/:jobId",checkSubscription, (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const jobId = req.params.jobId;
    const farmerId = req.session.farmer.id;

    const query = "UPDATE jobs SET status = 'Closed' WHERE id = ? AND farmer_id = ?";

    db.query(query, [jobId, farmerId], (err, result) => {
        if (err) {
            console.log(err);
            return res.render("error", {
                message: "Error closing job.",
                backLink: "/farmer/dashboard"
            });
        }

        if (result.affectedRows === 0) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        return res.render("message", {
            title: "Job Closed",
            message: "This job has been closed successfully. Workers will no longer see it.",
            backLink: "/farmer/dashboard"
        });
    });
});

app.post("/farmer/reopen-job/:jobId",checkSubscription, (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const jobId = req.params.jobId;
    const farmerId = req.session.farmer.id;

    const query = "UPDATE jobs SET status = 'Open' WHERE id = ? AND farmer_id = ?";

    db.query(query, [jobId, farmerId], (err, result) => {
        if (err) {
            console.log(err);
            return res.render("error", {
                message: "Error reopening job.",
                backLink: "/farmer/dashboard"
            });
        }

        if (result.affectedRows === 0) {
            return res.render("error", {
                message: "Job not found or unauthorized access.",
                backLink: "/farmer/dashboard"
            });
        }

        return res.render("message", {
            title: "Job Reopened",
            message: "This job has been reopened successfully. Workers can now see and apply again.",
            backLink: "/farmer/dashboard"
        });
    });
});

app.get("/test-phone", (req, res) => {
    res.send("Phone reached laptop server successfully");
});

const PORT = process.env.PORT || 5000;

app.get("/check-payment-status", (req, res) => {
    const token = req.session.paymentToken;

    if (!token) {
        return res.json({ status: "pending" });
    }

    if (fakePayments[token] && fakePayments[token].status === "done") {
        return res.json({ status: "done" });
    }

    return res.json({ status: "pending" });
});

app.get("/marketplace", (req, res) => {
    const { category = "", item_type = "", location = "", keyword = "" } = req.query;

    let query = `
        SELECT marketplace_items.*, farmers.full_name
        FROM marketplace_items
        JOIN farmers ON marketplace_items.farmer_id = farmers.id
        WHERE marketplace_items.status = 'Available'
    `;

    const params = [];

    if (category) {
        query += " AND marketplace_items.category = ?";
        params.push(category);
    }

    if (item_type) {
        query += " AND marketplace_items.item_type = ?";
        params.push(item_type);
    }

    if (location) {
        query += " AND marketplace_items.location LIKE ?";
        params.push(`%${location}%`);
    }

    if (keyword) {
        query += " AND marketplace_items.item_title LIKE ?";
        params.push(`%${keyword}%`);
    }

    query += " ORDER BY marketplace_items.created_at DESC";

    db.query(query, params, (err, items) => {
        if (err) {
            console.log("MARKETPLACE ERROR:", err);
            return res.render("error", {
                message: "Error fetching marketplace items.",
                backLink: "/"
            });
        }

        res.render("marketplace", {
            items,
            filters: { category, item_type, location, keyword }
        });
    });
});

app.get("/farmer/my-marketplace-items", checkSubscription,(req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const farmer_id = req.session.farmer.id;

    const query = `
        SELECT * FROM marketplace_items
        WHERE farmer_id = ?
        ORDER BY created_at DESC
    `;

    db.query(query, [farmer_id], (err, items) => {
        if (err) {
            console.log(err);
            return res.render("error", {
                message: "Error fetching your items.",
                backLink: "/farmer/dashboard"
            });
        }

        res.render("my-marketplace-items", { items });
    });
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

app.get("/marketplace/item/:id", (req, res) => {
    const itemId = req.params.id;

    const query = `
        SELECT marketplace_items.*, farmers.full_name
        FROM marketplace_items
        JOIN farmers ON marketplace_items.farmer_id = farmers.id
        WHERE marketplace_items.id = ?
    `;

    db.query(query, [itemId], (err, results) => {
        if (err) {
            console.log("MARKETPLACE ITEM DETAILS ERROR:", err);
            return res.render("error", {
                message: "Error fetching item details.",
                backLink: "/marketplace"
            });
        }

        if (results.length === 0) {
            return res.render("error", {
                message: "Marketplace item not found.",
                backLink: "/marketplace"
            });
        }

        res.render("marketplace-item-details", {
            item: results[0]
        });
    });
});

app.post("/farmer/post-marketplace-item",checkSubscription, (req, res) => {
    if (req.subscriptionExpired) {
    return res.render("message", {
        title: "Subscription Expired",
        message: "Renew subscription to post jobs.",
        backLink: "/farmer/renew-subscription"
    });
}

    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const farmer_id = req.session.farmer.id;

    const {
        item_title,
        category,
        item_type,
        description,
        price,
        location,
        contact_phone,
        image_url
    } = req.body;

    const query = `
        INSERT INTO marketplace_items
        (farmer_id, item_title, category, item_type, description, price, location, contact_phone, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        query,
        [
            farmer_id,
            item_title,
            category,
            item_type,
            description,
            price,
            location,
            contact_phone,
            image_url
        ],
        (err) => {
            if (err) {
                console.log("POST MARKETPLACE ITEM ERROR:", err);
                return res.render("error", {
                    message: "Error posting marketplace item.",
                    backLink: "/farmer/post-marketplace-item"
                });
            }

            return res.render("message", {
                title: "Item Posted",
                message: "Your marketplace item has been posted successfully.",
                backLink: "/marketplace"
            });
        }
    );
});

app.post("/farmer/delete-marketplace-item/:id", checkSubscription, (req, res) => {
    if (req.subscriptionExpired) {
    return res.render("message", {
        title: "Subscription Expired",
        message: "Renew subscription to post jobs.",
        backLink: "/farmer/renew-subscription"
    });
}
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const itemId = req.params.id;
    const farmer_id = req.session.farmer.id;

    const query = `
        DELETE FROM marketplace_items
        WHERE id = ? AND farmer_id = ?
    `;

    db.query(query, [itemId, farmer_id], (err) => {
        if (err) {
            console.log(err);
            return res.render("error", {
                message: "Error deleting item.",
                backLink: "/farmer/my-marketplace-items"
            });
        }

        res.redirect("/farmer/my-marketplace-items");
    });
});

app.get("/farmer/edit-marketplace-item/:id", checkSubscription, (req, res) => {
    if (req.subscriptionExpired) {
    return res.render("message", {
        title: "Subscription Expired",
        message: "Renew subscription to post jobs.",
        backLink: "/farmer/renew-subscription"
    });
}

    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const itemId = req.params.id;
    const farmer_id = req.session.farmer.id;

    const query = `
        SELECT * FROM marketplace_items
        WHERE id = ? AND farmer_id = ?
    `;

    db.query(query, [itemId, farmer_id], (err, results) => {
        if (err) {
            console.log("EDIT MARKETPLACE GET ERROR:", err);
            return res.render("error", {
                message: "Error fetching marketplace item.",
                backLink: "/farmer/my-marketplace-items"
            });
        }

        if (results.length === 0) {
            return res.render("error", {
                message: "Item not found or unauthorized access.",
                backLink: "/farmer/my-marketplace-items"
            });
        }

        res.render("edit-marketplace-item", {
            item: results[0]
        });
    });
});

app.post("/farmer/edit-marketplace-item/:id", checkSubscription, (req, res) => {
    if (req.subscriptionExpired) {
    return res.render("message", {
        title: "Subscription Expired",
        message: "Renew subscription to post jobs.",
        backLink: "/farmer/renew-subscription"
    });
}
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const itemId = req.params.id;
    const farmer_id = req.session.farmer.id;

    const {
        item_title,
        category,
        item_type,
        description,
        price,
        location,
        contact_phone,
        image_url
    } = req.body;

    const query = `
        UPDATE marketplace_items
        SET item_title = ?, category = ?, item_type = ?, description = ?, price = ?, location = ?, contact_phone = ?, image_url = ?
        WHERE id = ? AND farmer_id = ?
    `;

    db.query(
        query,
        [
            item_title,
            category,
            item_type,
            description,
            price,
            location,
            contact_phone,
            image_url,
            itemId,
            farmer_id
        ],
        (err, result) => {
            if (err) {
                console.log("EDIT MARKETPLACE POST ERROR:", err);
                return res.render("error", {
                    message: "Error updating marketplace item.",
                    backLink: "/farmer/my-marketplace-items"
                });
            }

            return res.render("message", {
                title: "Item Updated",
                message: "Marketplace item updated successfully.",
                backLink: "/farmer/my-marketplace-items"
            });
        }
    );
});

app.post("/farmer/mark-marketplace-item/:id", checkSubscription, (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const itemId = req.params.id;
    const farmer_id = req.session.farmer.id;
    const { status } = req.body;

    const query = `
        UPDATE marketplace_items
        SET status = ?
        WHERE id = ? AND farmer_id = ?
    `;

    db.query(query, [status, itemId, farmer_id], (err) => {
        if (err) {
            console.log("MARK MARKETPLACE ITEM ERROR:", err);
            return res.render("error", {
                message: "Error updating item status.",
                backLink: "/farmer/my-marketplace-items"
            });
        }

        res.redirect("/farmer/my-marketplace-items");
    });
});

app.get("/farmer/renew-subscription", (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    res.render("farmer-renew-subscription");
});

app.post("/farmer/renew-subscription", (req, res) => {
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
    const token = crypto.randomBytes(16).toString("hex");

    fakePayments[token] = {
        status: "pending",
        type: "renewal",
        farmerId: req.session.farmer.id,
        data: {
            subscription_amount: amount,
            subscription_months: months,
            subscription_plan_label: `${amount} - ${months} months`,
            currentLang
        }
    };

    req.session.paymentToken = token;

    res.redirect(`/farmer/subscription-payment?lang=${currentLang}`);
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

// Start server on all networks (important)
app.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log(`🚀 Server running on:`);
    console.log(`👉 Local:   http://localhost:${PORT}`);
    console.log(`👉 Network: http://127.0.0.1:${PORT}`);
    console.log("=================================");
});