const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
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
            village: farmer.village
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

app.get("/farmer/post-job", (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    res.render("post-job");
});

app.post("/farmer/register", async (req, res) => {
    try {
        const { full_name, phone, village, email, password, subscription_plan } = req.body;
        const currentLang = req.query.lang || "en";

        const checkQuery = "SELECT * FROM farmers WHERE email = ?";

        db.query(checkQuery, [email], async (err, result) => {
            if (err) {
                console.log("REGISTER CHECK ERROR:", err);
                return res.render("error", {
                    message: "Database error while checking farmer.",
                    backLink: `/farmer/register?lang=${currentLang}`
                });
            }

            if (result.length > 0) {
                return res.render("error", {
                    message: "Email already registered.",
                    backLink: `/farmer/register?lang=${currentLang}`
                });
            }

            if (!subscription_plan) {
                return res.render("error", {
                    message: "Please select a subscription plan.",
                    backLink: `/farmer/register?lang=${currentLang}`
                });
            }

            const [amount, months] = subscription_plan.split("|");
            const token = crypto.randomBytes(16).toString("hex");

            req.session.pendingFarmer = {
                full_name,
                phone,
                village,
                email,
                password,
                subscription_amount: amount,
                subscription_months: months,
                subscription_plan_label: `${amount} - ${months} months`,
                currentLang,
                paymentToken: token
            };

            fakePayments[token] = {
                status: "pending",
                createdAt: Date.now()
            };

            return res.redirect(`/farmer/subscription-payment?lang=${currentLang}`);
        });
    } catch (error) {
        console.log("REGISTER ROUTE ERROR:", error);
        return res.render("error", {
            message: "Server error.",
            backLink: "/farmer/register"
        });
    }
});

app.get("/farmer/subscription-payment", (req, res) => {
    if (!req.session.pendingFarmer) {
        return res.redirect(`/farmer/register?lang=${req.query.lang || "en"}`);
    }

    const currentLang = req.query.lang || req.session.pendingFarmer.currentLang || "en";
    const token = req.session.pendingFarmer.paymentToken;

    // PUT YOUR REAL LAPTOP IP HERE
    const laptopIp = "192.168.0.1";

    const paymentUrl = `http://${laptopIp}:5000/farmer/demo-pay/${token}?lang=${currentLang}`;

    res.render("farmer-subscription-payment", {
        farmerData: req.session.pendingFarmer,
        paymentUrl,
        paymentToken: token
    });
});

app.post("/farmer/confirm-payment", async (req, res) => {
    try {
        if (!req.session.pendingFarmer) {
            return res.redirect(`/farmer/register?lang=${req.query.lang || "en"}`);
        }

        const {
            full_name,
            phone,
            village,
            email,
            password,
            subscription_amount,
            subscription_months,
            subscription_plan_label,
            currentLang
        } = req.session.pendingFarmer;

        const checkQuery = "SELECT * FROM farmers WHERE email = ?";

        db.query(checkQuery, [email], async (checkErr, checkResult) => {
            if (checkErr) {
                console.log("CONFIRM PAYMENT CHECK ERROR:", checkErr);
                return res.render("error", {
                    message: "Error checking farmer account before payment confirmation.",
                    backLink: `/farmer/register?lang=${currentLang || "en"}`
                });
            }

            if (checkResult.length > 0) {
                req.session.pendingFarmer = null;
                return res.render("error", {
                    message: "This email is already registered.",
                    backLink: `/farmer/login?lang=${currentLang || "en"}`
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

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
                    parseFloat(subscription_amount),
                    parseInt(subscription_months),
                    "Paid",
                    startDate.toISOString().split("T")[0],
                    endDate.toISOString().split("T")[0]
                ],
                (err) => {
                    if (err) {
                        console.log("CONFIRM PAYMENT INSERT ERROR:", err);
                        return res.render("error", {
                            message: "Error creating farmer account after payment.",
                            backLink: `/farmer/register?lang=${currentLang || "en"}`
                        });
                    }

                    req.session.pendingFarmer = null;

                    return res.render("message", {
                        title: "Registration Successful",
                        message: "Demo payment successful. Your farmer account has been created.",
                        backLink: `/farmer/login?lang=${currentLang || "en"}`
                    });
                }
            );
        });
    } catch (error) {
        console.log("CONFIRM PAYMENT ROUTE ERROR:", error);
        return res.render("error", {
            message: "Server error.",
            backLink: "/farmer/register"
        });
    }
});

app.get("/farmer/dashboard", (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const farmer = req.session.farmer;

    const query = `
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

    db.query(query, [farmer.id], (err, jobs) => {
        if (err) {
            console.log("FARMER DASHBOARD ERROR:", err);
            return res.send("Error fetching farmer jobs.");
        }

        res.render("farmer-dashboard", { farmer, jobs });
    });
});

app.post("/farmer/post-job", (req, res) => {
    if (!req.session.farmer) {
        return res.redirect("/farmer/login");
    }

    const farmer_id = req.session.farmer.id;

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

    const insertJobQuery = `
        INSERT INTO jobs 
        (farmer_id, job_title, category, work_type, description, location, wage, workers_required, payment_mode, start_date, end_date, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    db.query(
        insertJobQuery,
        [
            farmer_id,
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
        ],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.send("Error posting job.");
            }

            const jobId = result.insertId;

            const insertVersionQuery = `
                INSERT INTO job_versions
                (job_id, version, job_title, category, work_type, description, location, wage, payment_mode, start_date, end_date, restored_from_version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            `;

            db.query(
                insertVersionQuery,
                [
                    jobId,
                    1,
                    job_title,
                    category,
                    work_type,
                    description,
                    location,
                    wage,
                    payment_mode,
                    start_date,
                    end_date
                ],
                (versionErr) => {
                    if (versionErr) {
                        console.log(versionErr);
                        return res.send("Job created, but version history could not be saved.");
                    }

                    res.redirect(`/farmer/dashboard?lang=${req.query.lang || "en"}`);
                }
            );
        }
    );
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

app.get("/farmer/job-applications/:jobId", (req, res) => {
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

app.post("/farmer/application/update/:appId", (req, res) => {
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

app.get("/farmer/edit-job/:jobId", (req, res) => {
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

app.post("/farmer/edit-job/:jobId", (req, res) => {
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

app.get("/farmer/job-history/:jobId", (req, res) => {
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

app.post("/farmer/delete-job/:jobId", (req, res) => {
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

app.post("/farmer/close-job/:jobId", (req, res) => {
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

app.post("/farmer/reopen-job/:jobId", (req, res) => {
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

// app.post("/farmer/delete-job/:jobId", (req, res) => {
//     if (!req.session.farmer) {
//         return res.redirect("/farmer/login");
//     }

//     const jobId = req.params.jobId;
//     const farmerId = req.session.farmer.id;

//     const checkQuery = "SELECT * FROM jobs WHERE id = ? AND farmer_id = ?";

//     db.query(checkQuery, [jobId, farmerId], (checkErr, checkResult) => {
//         if (checkErr) {
//             console.log(checkErr);
//             return res.render("error", {
//                 message: "Error checking job before deletion.",
//                 backLink: "/farmer/dashboard"
//             });
//         }

//         if (checkResult.length === 0) {
//             return res.render("error", {
//                 message: "Job not found or unauthorized access.",
//                 backLink: "/farmer/dashboard"
//             });
//         }

//         const deleteVersionsQuery = "DELETE FROM job_versions WHERE job_id = ?";

//         db.query(deleteVersionsQuery, [jobId], (versionErr) => {
//             if (versionErr) {
//                 console.log(versionErr);
//                 return res.render("error", {
//                     message: "Error deleting job version history.",
//                     backLink: "/farmer/dashboard"
//                 });
//             }

//             const deleteApplicationsQuery = "DELETE FROM job_applications WHERE job_id = ?";

//             db.query(deleteApplicationsQuery, [jobId], (appErr) => {
//                 if (appErr) {
//                     console.log(appErr);
//                     return res.render("error", {
//                         message: "Error deleting job applications.",
//                         backLink: "/farmer/dashboard"
//                     });
//                 }

//                 const deleteJobQuery = "DELETE FROM jobs WHERE id = ? AND farmer_id = ?";

//                 db.query(deleteJobQuery, [jobId, farmerId], (deleteErr, deleteResult) => {
//                     if (deleteErr) {
//                         console.log(deleteErr);
//                         return res.render("error", {
//                             message: "Error deleting job.",
//                             backLink: "/farmer/dashboard"
//                         });
//                     }

//                     return res.render("message", {
//                         title: "Job Deleted",
//                         message: "The job was deleted successfully. It will no longer appear for workers.",
//                         backLink: "/farmer/dashboard"
//                     });
//                 });
//             });
//         });
//     });
// });

const PORT = process.env.PORT || 5000;

// Start server on all networks (important)
app.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log(`🚀 Server running on:`);
    console.log(`👉 Local:   http://localhost:${PORT}`);
    console.log(`👉 Network: http://127.0.0.1:${PORT}`);
    console.log("=================================");
});