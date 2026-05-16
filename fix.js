const fs = require("fs");
let content = fs.readFileSync("app.js", "utf8");

// Normalize line endings to avoid matching issues
content = content.replace(/\r\n/g, '\n');

const brokenBlock = `            recentMarketplaceItems,
            subscriptionWarning,
            subscriptionExpired: req.subscriptionExpired
                message: "Please select at least one skill.",`;

const fixedBlock = `            recentMarketplaceItems,
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

app.get("/logout", async (req, res) => {
    const firebaseUID = req.session?.farmer?.firebaseUID || req.session?.worker?.firebaseUID;
    
    if (firebaseUID) {
        try {
            const admin = require("./config/firebaseAdmin");
            await admin.auth().revokeRefreshTokens(firebaseUID);
        } catch (err) {
            console.log("Error revoking Firebase tokens:", err);
        }
    }

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
                message: "Please select at least one skill.",`;

if (content.includes(brokenBlock)) {
    content = content.replace(brokenBlock, fixedBlock);
    fs.writeFileSync("app.js", content);
    console.log("Successfully repaired app.js!");
} else {
    console.log("Broken block not found. Checking if partial match exists...");
    
    // Fallback: Use regex to match the exact weird bridging gap
    const regex = /subscriptionExpired: req\.subscriptionExpired[\s\S]*?message: "Please select at least one skill\.",/;
    
    if (regex.test(content)) {
        content = content.replace(regex, fixedBlock.replace('            recentMarketplaceItems,\n            subscriptionWarning,\n', ''));
        fs.writeFileSync("app.js", content);
        console.log("Repaired using regex fallback!");
    } else {
        console.log("Still could not find the broken segment.");
    }
}
