const fs = require('fs');
const lines = fs.readFileSync('app.js', 'utf8').split('\n');
lines.forEach((line, i) => {
    if (line.includes('app.post') && line.includes('verify')) {
        console.log(`Line ${i+1}: ${line}`);
    }
    if (line.includes('MONGO REGISTER ERROR')) {
        console.log(`Line ${i+1}: ${line}`);
    }
});
