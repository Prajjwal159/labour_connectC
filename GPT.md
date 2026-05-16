# 🤖 Project Context for ChatGPT

**Hello ChatGPT!** I am providing you with the complete context of my project so that you can assist me in writing new features, refactoring code, or fixing bugs. Whenever I ask for a change, please use the information below to give me **highly precise, step-by-step instructions and code snippets** tailored specifically to this architecture.

---

## 📌 Project Overview
**Name:** Labour Connect (Namma Raitha Jobs)
**Purpose:** A platform to bridge the gap between farmers (who need agricultural workers or want to sell items) and workers (who are looking for agricultural jobs).

## 🛠️ Tech Stack & Architecture
* **Backend:** Node.js, Express.js
* **Database:** MongoDB (using Mongoose schemas)
* **Frontend:** EJS (Embedded JavaScript templates), Vanilla HTML/CSS/JS
* **Authentication:** `express-session` (for session management) and `bcryptjs` (for password hashing)
* **Payments:** Razorpay API (used for farmer subscriptions, job postings, and worker registration fees)
* **Localization:** Custom i18n implementation in `locales/translations.js` supporting English (`en`) and Kannada (`kn`).

**Architecture Style:** Monolithic Application.
* 🚨 **Important:** Almost all routing, business logic, and payment verification is currently centralized in a single large file: `app.js`.
* Views are stored in the `views/` directory.
* Static assets are in the `public/` directory.

---

## 🗄️ Database Models (Mongoose)
The project is built around these 5 core models located in the `models/` folder:

1. **`Farmer.js`**: Stores farmer profile details, password, and subscription tracking (plan name, start/end dates, amount, status).
2. **`Worker.js`**: Stores worker profile details, skills category (array of strings), experience level, and password.
3. **`Job.js`**: Represents jobs posted by farmers. Tracks `farmer_id`, title, category, wage, workers required, and status (Open/Closed).
4. **`JobApplication.js`**: A junction model linking a `worker_id` to a `job_id`. Tracks the application status (Applied, Accepted, etc.).
5. **`MarketplaceItem.js`**: Items listed by farmers for sale. Tracks `farmer_id`, item details, and status (Available, Sold).

---

## 🔄 Core Workflows & Logic

### 1. User Personas
* **Farmers:** Must register and log in. To post jobs, they must purchase a subscription via Razorpay. They can post jobs and review applications. They also have access to a Marketplace to list agricultural goods.
* **Workers:** Must register (paying a one-time onboarding fee via Razorpay) and log in. They can browse open jobs, filter by wage/location, and submit applications.

### 2. Job Application Lifecycle
1. Farmer pays and posts a `Job` (Requires active subscription).
2. Worker finds the job and clicks "Apply". A `JobApplication` document is created.
3. Farmer sees the application in their dashboard and can update the status (e.g., Accept).
4. **Auto-Closure logic:** When the number of 'Accepted' + 'Applied' applications reaches the `workers_required` threshold defined in the `Job`, the job status automatically flips to `Closed`.

### 3. Payment Flow (Razorpay)
The `app.js` file handles payments by:
1. Creating a Razorpay order.
2. Rendering the `razorpay-payment.ejs` view with the order details.
3. Using an in-memory `paymentSessions` object to temporarily store what the user was paying for (subscription vs. job posting vs. worker registration) until the payment signature is verified.

---

## 🎯 Instructions for ChatGPT (Prompt Generation Rules)

When I ask you to make a change, add a feature, or write a prompt for another AI, please follow these strict rules:
1. **Be highly precise:** Refer strictly to the models, tech stack, and file structure mentioned above.
2. **Target specific files:** Always tell me exactly which files to edit (e.g., "Add this route to `app.js`", "Modify the `Job.js` schema", "Update `views/farmer-dashboard.ejs`").
3. **Account for the Monolith:** Remember that routes go into `app.js`. If I ask for a refactor, suggest splitting `app.js` into an Express `routes/` and `controllers/` folder structure.
4. **Consider Dependencies:** Do not suggest using React, Tailwind (unless requested), or external libraries I don't already have, unless you also provide the exact `npm install` command.
5. **Formatting:** Provide clean, copy-pasteable code blocks. 

**Wait for my next message containing the specific feature request or bug I want to work on!**
