# Labour Connect (Namma Raitha Jobs) — Full Firebase Authentication Migration

This document provides EXTREMELY detailed instructions on how to set up Firebase and migrate the project.

## 1. Firebase Project Creation
- Go to the [Firebase Console](https://console.firebase.google.com/).
- Click on "Add Project".
- Name your project (e.g., `Labour Connect`).
- Disable Google Analytics if not needed, then click "Create Project".

## 2. Enable Email/Password Auth
- In the Firebase Console, go to **Authentication** from the left menu.
- Click **Get Started**.
- Go to the **Sign-in method** tab.
- Click **Email/Password** and enable it. Click **Save**.

## 3. Configure Firebase Web App
- Go to **Project Overview** (gear icon -> Project settings).
- Under "Your apps", click the Web icon (`</>`).
- Register the app (e.g., `Labour Connect Web`).
- You don't need Firebase Hosting, so leave it unchecked.
- Click **Register app**.

## 4. Obtain Firebase Config Values
- After registering, you will see a `firebaseConfig` object.
- Copy the `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId`.
- Paste these values into your `.env` file corresponding variables (e.g., `FIREBASE_API_KEY`).

## 5. Generate Service Account Credentials
- In Project settings, go to the **Service accounts** tab.
- Make sure "Node.js" is selected.
- Click **Generate new private key**.

## 6. Download Service-Account JSON
- The private key will download as a JSON file.
- Keep this file safe!

## 7. Safely Store Firebase Credentials
- Open the downloaded JSON file.
- Copy the `client_email` and `private_key` (including `\n` characters) into your `.env` file as `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`.
- You can optionally save the entire file as `serviceAccountKey.json` in the project root, but it is already added to `.gitignore`. **Do not commit this file or your `.env` file to source control.**

## 8. Configure `.env`
Your `.env` should have:
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Key\n-----END PRIVATE KEY-----\n"
FIREBASE_API_KEY=your_web_api_key
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
SESSION_SECRET=a_very_long_secure_secret_string
BASE_URL=http://localhost:3000
NODE_ENV=development
```

## 9. Switching Firebase Accounts Later
The current Firebase account is TEMPORARY. You can easily switch to a production Firebase account later.
To do this:
1. Create a new Firebase project following steps 1-6.
2. Replace the variables in your `.env` file with the new project's values.
3. No code changes are required!

## 10. Replace Current Firebase Project Safely
- Just update `.env` and restart the server.
- The app logic will continue working without changes.

## 11. Rotate Credentials
- If a key is compromised, generate a new private key from the Firebase Console (Service accounts tab).
- Delete the old key in the console.
- Update `FIREBASE_PRIVATE_KEY` in `.env` and restart your app.

## 12. Test Authentication Locally
- Run `npm run dev`.
- Ensure you have `.env` properly configured.
- Try registering a new user. Check if they appear in Firebase Authentication console.
- Try logging in.
- Test the forgot password and email verification flows.

## 13. Deploy to Vercel
- Add all environment variables from `.env` to Vercel's Environment Variables settings.
- **IMPORTANT**: When pasting `FIREBASE_PRIVATE_KEY` in Vercel, make sure the `\n` characters are properly preserved, or just wrap it in quotes if needed.
- Connect your GitHub repo and deploy.

## 14. Common Firebase Errors
- `auth/email-already-in-use`: User already exists in Firebase.
- `auth/invalid-email`: The email format is wrong.
- `auth/weak-password`: Password is less than 6 characters.
- `auth/user-not-found`: The email is not registered.
- `auth/wrong-password`: Incorrect password.
- `Decoding Firebase ID token failed`: The token is invalid or expired, user needs to re-login.

## 15. Security Rules & Notes
- Ensure your MongoDB is protected.
- Never expose `FIREBASE_PRIVATE_KEY` to the frontend.
- Validate inputs on both frontend and backend.
- Firebase handles rate-limiting on auth routes automatically.

## 16. Session/Token Explanation
- **Frontend**: Authenticates with Firebase and receives an ID token.
- **Backend**: Verifies the ID token using `firebase-admin`.
- **Session**: A MongoDB-backed session is created using `express-session` and `connect-mongo`. This means the user stays logged in across the application seamlessly without constant token checks, matching the existing app architecture.

## 17. Firebase Free-Tier Notes
- Firebase Authentication is free up to 50,000 MAU (Monthly Active Users).
- The Spark (free) plan is sufficient for development and early production.

## 18. Production Readiness Notes
- Use strong `SESSION_SECRET`.
- Ensure `NODE_ENV=production` is set so cookies are secure.
- Restrict your Firebase API Key to your specific domains in Google Cloud Console.

## 19. Troubleshooting Section
- **Emails not sending**: Check Firebase Authentication -> Templates. Ensure the domain is authorized if using a custom domain.
- **Session drops**: Check your MongoDB connection and `connect-mongo` configuration.
- **Token verification fails**: Make sure the backend system clock is accurate and `FIREBASE_PROJECT_ID` is correct.
