import fs from 'fs';
import path from 'path';

const rootDir = 'C:\\Users\\aamer\\Desktop\\SaudiEx project agents\\gimi integrartion\\gimi-mobile';

function deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                // recurse
                deleteFolderRecursive(curPath);
            } else {
                // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folderPath);
        console.log(`Deleted folder: ${folderPath}`);
    }
}

function findAndClean(dir) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        return;
    }

    for (const file of files) {
        const fullPath = path.join(dir, file);
        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch (e) {
            continue;
        }

        if (stat.isDirectory()) {
            if (file === '.cxx' || file === 'build') {
                try {
                    deleteFolderRecursive(fullPath);
                } catch (err) {
                    console.error(`Failed to delete ${fullPath}:`, err.message);
                }
            } else if (file !== 'node_modules' || dir.endsWith('gimi-mobile')) {
                // Only recurse into node_modules if it is the top-level node_modules,
                // or if we are descending into specific packages.
                findAndClean(fullPath);
            }
        }
    }
}

console.log(`Starting cleanup of CMake and build outputs in ${rootDir}...`);
findAndClean(rootDir);
console.log("Cleanup complete!");
