import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const srcDir = '/Users/Huvrs/Downloads/skylens-ai---enterprise-drone-inspection (3)';
const destDir = '/Users/Huvrs/Projects/axis-drone-platform';

const dirsToSync = [
    'backend',
    'components',
    'modules',
    'src',
    'types.ts',
    'package.json'
];

try {
    console.log('🔄 Starting sync to production...');
    for (const dir of dirsToSync) {
        const srcPath = path.join(srcDir, dir);
        const destPath = path.join(destDir, dir);

        if (fs.existsSync(srcPath)) {
            console.log(`Copying ${dir}...`);
            // Use rsync to copy, preserving directories and ignoring node_modules
            execSync(`rsync -avz --exclude='node_modules' "${srcPath}" "${dir.includes('.') ? destDir : destDir + '/'}"`, { stdio: 'inherit' });
        }
    }

    console.log('✅ Sync complete! Restarting backend...');
    execSync(`cd "${destDir}/backend" && npm install`, { stdio: 'inherit' });

    // Restart backend via pm2 or whatever if it's running
    try {
        execSync(`pm2 restart all`, { stdio: 'ignore' });
    } catch (e) {
        console.log('PM2 not found or no processes. Restarting might be manual.');
    }

    console.log('✅ All done!');
} catch (error) {
    console.error('❌ Sync failed:', error.message);
}
