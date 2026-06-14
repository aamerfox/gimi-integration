import fs from 'fs';
import path from 'path';

const rootDir = 'C:\\Users\\aamer\\Desktop\\SaudiEx project agents\\gimi integrartion\\gimi-mobile';
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

function deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folderPath);
    }
}

function processDirectory(dir) {
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
            stat = fs.lstatSync(fullPath);
        } catch (e) {
            continue;
        }

        if (stat.isDirectory()) {
            const isNdkFolder = file === '.cxx' || (file === 'build' && dir.includes('android'));
            if (isNdkFolder) {
                try {
                    deleteFolderRecursive(fullPath);
                    console.log(`Deleted NDK folder: ${fullPath}`);
                } catch (err) {
                    // Ignore locks/permissions
                }
            } else {
                processDirectory(fullPath);
            }
        } else if (stat.isFile()) {
            const ext = path.extname(file).toLowerCase();
            const isSourceOrBuildFile = 
                file === 'CMakeLists.txt' || 
                ext === '.cmake' || 
                ext === '.gradle' || 
                ext === '.cpp' || 
                ext === '.h';
            
            if (isSourceOrBuildFile) {
                try {
                    fs.utimesSync(fullPath, tenMinutesAgo, tenMinutesAgo);
                } catch (err) {
                    // Ignore write locks
                }
            }
        }
    }
}

console.log(`Starting touch and clean in ${rootDir}...`);
processDirectory(rootDir);
console.log("Touch and clean complete!");
