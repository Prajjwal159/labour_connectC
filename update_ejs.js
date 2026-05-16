const fs = require("fs");

function addFirebaseLoginScript(filename) {
    let content = fs.readFileSync(filename, "utf8");
    if (!content.includes("firebaseClient.js")) {
        const script = `
<script>
    window.firebaseConfig = <%- JSON.stringify(firebaseConfig || {}) %>;
</script>
<script type="module">
    import { auth } from '/js/firebaseClient.js';
    import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

    const form = document.querySelector('form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.email.value;
        const password = form.password.value;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerText = "Loading...";
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const token = await userCredential.user.getIdToken();
            
            const response = await fetch(form.action, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            if (data.success) {
                window.location.href = data.redirect;
            } else {
                alert(data.error || "Login failed");
                submitBtn.disabled = false;
                submitBtn.innerText = "Login";
            }
        } catch(error) {
            console.error(error);
            alert("Firebase Login Error: " + error.message);
            submitBtn.disabled = false;
            submitBtn.innerText = "Login";
        }
    });
</script>
</body>`;
        content = content.replace("</body>", script);
        fs.writeFileSync(filename, content);
    }
}

function addFirebaseRegisterScript(filename) {
    let content = fs.readFileSync(filename, "utf8");
    if (!content.includes("firebaseClient.js")) {
        const script = `
<script>
    window.firebaseConfig = <%- JSON.stringify(firebaseConfig || {}) %>;
</script>
<script type="module">
    import { auth } from '/js/firebaseClient.js';
    import { createUserWithEmailAndPassword, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

    const form = document.querySelector('form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.email.value;
        const password = form.password.value;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerText = "Processing...";
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);
            
            const uidInput = document.createElement('input');
            uidInput.type = 'hidden';
            uidInput.name = 'firebaseUID';
            uidInput.value = userCredential.user.uid;
            form.appendChild(uidInput);
            
            // Allow form to submit normally to Razorpay flow
            form.submit();
        } catch(error) {
            console.error(error);
            alert("Registration failed: " + error.message);
            submitBtn.disabled = false;
            submitBtn.innerText = "Register";
        }
    });
</script>
</body>`;
        content = content.replace("</body>", script);
        fs.writeFileSync(filename, content);
    }
}

function addFirebaseForgotScript(filename) {
    let content = fs.readFileSync(filename, "utf8");
    if (!content.includes("firebaseClient.js")) {
        const script = `
<script>
    window.firebaseConfig = <%- JSON.stringify(firebaseConfig || {}) %>;
</script>
<script type="module">
    import { auth } from '/js/firebaseClient.js';
    import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

    const form = document.querySelector('form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.email.value;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerText = "Sending...";
            
            await sendPasswordResetEmail(auth, email);
            
            alert("Password reset email sent! Please check your inbox.");
            window.location.href = form.action.includes('farmer') ? '/farmer/login' : '/worker/login';
        } catch(error) {
            console.error(error);
            alert("Error: " + error.message);
            submitBtn.disabled = false;
            submitBtn.innerText = "Reset Password";
        }
    });
</script>
</body>`;
        content = content.replace("</body>", script);
        fs.writeFileSync(filename, content);
    }
}

addFirebaseLoginScript("views/farmer-login.ejs");
addFirebaseLoginScript("views/worker-login.ejs");
addFirebaseRegisterScript("views/farmer-register.ejs");
addFirebaseRegisterScript("views/worker-register.ejs");
addFirebaseForgotScript("views/farmer-forgot-password.ejs");
addFirebaseForgotScript("views/worker-forgot-password.ejs");

console.log("EJS files updated with Firebase Auth scripts.");
