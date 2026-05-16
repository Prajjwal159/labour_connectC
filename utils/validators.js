const validator = require('validator');

const validateEmail = (email) => {
    if (!email) return false;
    return validator.isEmail(email.trim());
};

const validatePassword = (password) => {
    // Minimum 8 chars, uppercase, lowercase, number, special character
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passRegex.test(password);
};

const validatePhone = (phone) => {
    if (!phone) return false;
    // Basic validation for 10 digit Indian phone numbers
    return validator.isMobilePhone(phone, 'en-IN');
};

const sanitizeInput = (input) => {
    if (!input) return "";
    return validator.escape(input.trim());
};

module.exports = {
    validateEmail,
    validatePassword,
    validatePhone,
    sanitizeInput
};
