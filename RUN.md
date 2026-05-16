# 🌾 Labour Connect (Namma Raitha Jobs) - Setup Guide

Welcome! This guide will walk you through setting up and running the **Labour Connect** project on your local machine.

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v16 or higher recommended) - [Download here](https://nodejs.org/)
- **MongoDB** (You can use a local instance or a free cloud cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- **A Firebase Project** (Required for Authentication)

---

## 🚀 Step-by-Step Installation

### 1. Clone & Open
1. Extract or clone the project folder.
2. Open your terminal in the `labour_connectC` directory.

### 2. Install Dependencies
Run the following command to install all required Node.js packages:
```bash
npm install
```

### 3. Setup Environment Variables (`.env`)
Create a file named **`.env`** in the root directory and add the following keys. You will need to replace the placeholders with your actual credentials:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
SESSION_SECRET=your_secure_session_secret

# MongoDB Configuration
MONGO_URI=your_mongodb_connection_string

# Firebase Configuration (Web App)
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Firebase Admin (Service Account)
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Key_Content\n-----END PRIVATE KEY-----\n"

# Razorpay Configuration (Payments)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Pricing
JOB_POSTING_FEE=29
WORKER_REGISTRATION_FEE=49
```

### 4. Setup Firebase Service Account
1. Go to **Firebase Console** > **Project Settings** > **Service Accounts**.
2. Click **Generate new private key**.
3. Save the JSON file as `serviceAccountKey.json` in the project root.

### 5. Start the Application
You can start the server in development mode (using nodemon):
```bash
npm run dev
```

### 6. Access the App
Open your browser and visit:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🏗️ Project Architecture
- **Backend:** Express.js, MongoDB (Mongoose)
- **Frontend:** EJS (Embedded JavaScript Templates), Vanilla CSS
- **Auth:** Firebase Authentication (ID Token verification on backend)
- **Payments:** Razorpay API Integration
- **Sessions:** `express-session` with `connect-mongo` for persistent logins.

## 🌍 Multi-language Support
The app supports **English** and **Kannada**. You can toggle the language using the `?lang=kn` or `?lang=en` query parameter or the UI language switcher.

