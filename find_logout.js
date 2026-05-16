const fs = require('fs');
const lines = fs.readFileSync('app.js', 'utf8').split('\n');
lines.forEach((line, i) => {
    if (line.includes('app.get') && line.includes('logout')) {
        console.log(`Line ${i+1}: ${line}`);
    }
});
