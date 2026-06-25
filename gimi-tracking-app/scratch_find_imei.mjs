import fs from 'fs';
import path from 'path';

const searchDir = 'c:/Users/aamer/Desktop/SaudiEx project agents/gimi integrartion';
const query = '990901';

function searchFile(filePath) {
    try {
        const stats = fs.statSync(filePath);
        if (stats.size > 10 * 1024 * 1024) return; // skip > 10MB
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes(query)) {
            console.log(`FOUND in: ${filePath}`);
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes(query)) {
                    console.log(`  Line ${idx + 1}: ${line.trim()}`);
                }
            });
        }
    } catch (e) {
        // ignore errors
    }
}

function traverse(dir) {
    if (dir.includes('node_modules') || dir.includes('.git') || dir.includes('.expo')) return;
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                traverse(fullPath);
            } else if (stats.isFile()) {
                searchFile(fullPath);
            }
        }
    } catch (e) {
        // ignore errors
    }
}

traverse(searchDir);
console.log('Search complete.');
