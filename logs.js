import { execSync } from 'child_process';
try {
    console.log(execSync('pm2 logs --lines 100 --nostream').toString());
} catch (e) {
    console.error("pm2 error:", e.message);
}
