import { execSync } from 'child_process';
import path from 'path';

const srcDir = '/Users/Huvrs/Downloads/skylens-ai---enterprise-drone-inspection (3)';
const destDir = '/Users/Huvrs/Projects/axis-drone-platform';

try {
    console.log('📦 Building frontend...');
    execSync('npm run build', { stdio: 'inherit', cwd: srcDir });

    console.log('🔄 Syncing dist/ back to production...');
    execSync(`rsync -avz "${path.join(srcDir, 'dist')}/" "${path.join(destDir, 'dist')}/"`, { stdio: 'inherit' });

    console.log('✅ Frontend successfully synced!');

    console.log('🔄 Syncing backend again for good measure...');
    execSync(`rsync -avz "${path.join(srcDir, 'backend')}/" "${path.join(destDir, 'backend')}/"`, { stdio: 'inherit' });

    console.log('✅ Full deployment complete.');
} catch (e) {
    console.error('Deployment failed:', e.message);
}
