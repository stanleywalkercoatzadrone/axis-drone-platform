import fs from 'fs';
import path from 'path';

const filesToDelete = [
    '/Users/Huvrs/Projects/axis-drone-platform/backend/controllers/ingestionController.js',
    '/Users/Huvrs/Projects/axis-drone-platform/backend/routes/ingestion.js'
];

filesToDelete.forEach(file => {
    if (fs.existsSync(file)) {
        try {
            fs.unlinkSync(file);
            console.log(`Deleted: ${file}`);
        } catch (err) {
            console.error(`Failed to delete ${file}:`, err);
        }
    } else {
        console.log(`File not found: ${file}`);
    }
});
