import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Your web app's Firebase configuration will be injected into window.firebaseConfig
// by EJS during rendering to keep it dynamic based on environment variables.

const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);

export { app, auth };
