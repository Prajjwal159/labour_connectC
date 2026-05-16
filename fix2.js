const fs = require("fs");

let content = fs.readFileSync("app.js", "utf8");

content = content.replace(
    /app\.post\("\/worker\/forgot-password", async \(req, res\) => \{\s*wage,/m,
    `app.post("/worker/forgot-password", async (req, res) => {
    // Handled by Firebase on frontend now
    res.redirect("/worker/login");
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
            wage,`
);

fs.writeFileSync("app.js", content);
console.log("app.js fixed safely.");
