import fs from 'fs';

const logFile = 'C:/Users/aamer/.gemini/antigravity-ide/brain/fe06afdb-d22a-43c3-92f2-8082931ffe7f/.system_generated/logs/transcript.jsonl';

try {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    console.log(`Read ${lines.length} lines from past transcript.`);

    let foundCount = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if ((line.includes('"accessToken"') || line.includes('"access_token"')) && line.includes('"code":0')) {
            // print a snippet of the line around the token
            console.log(`\nLine ${i + 1} match:`);
            const snippet = line.substring(0, 1500);
            console.log(snippet);
            foundCount++;
        }
    }
} catch (e) {
    console.error("Error reading past transcript:", e.message);
}
