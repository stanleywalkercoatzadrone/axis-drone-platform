import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import readline from 'readline';

const API_BASE_URL = process.env.API_URL || 'https://axis-platform-238975492579.us-central1.run.app/api';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

async function getFiles(dir, fileList = []) {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
        const stat = await fs.promises.stat(path.join(dir, file));
        if (stat.isDirectory()) {
            fileList = await getFiles(path.join(dir, file), fileList);
        } else {
            const ext = path.extname(file).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.tiff', '.tif'].includes(ext)) {
                fileList.push(path.join(dir, file));
            }
        }
    }
    return fileList;
}

async function bulkIngest() {
    console.log('=============================================');
    console.log('🛸 AXIS AI: BULK HISTORICAL DATA INGESTION 🛸');
    console.log('=============================================\n');

    const folderPath = await prompt('Enter the absolute path to your image folder:\n> ');
    if (!fs.existsSync(folderPath)) {
        console.error('❌ Folder does not exist. Please check the path and try again.');
        process.exit(1);
    }

    const token = await prompt('\nEnter your JWT Bearer Token (Copy this from your browser network tab / localStorage):\n> ');
    const missionId = await prompt('\nEnter the Mission ID (UUID) to attach these images to:\n> ');
    const uploadType = await prompt('\nEnter the Upload Type (images or thermal) [default: images]:\n> ') || 'images';

    console.log(`\n🔍 Scanning folder: ${folderPath}...`);
    const files = await getFiles(folderPath);
    console.log(`Found ${files.length} images.`);

    if (files.length === 0) {
        console.log('No images found. Exiting.');
        process.exit(0);
    }

    console.log(`\n🚀 Step 1: Creating Upload Job on Production...`);
    const jobRes = await fetch(`${API_BASE_URL}/pilot/upload-jobs`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            missionId,
            uploadType,
            missionFolder: 'Historical-Bulk-Upload',
            notes: 'Bulk ingested for AI Data Flywheel'
        })
    });

    if (!jobRes.ok) {
        const err = await jobRes.text();
        console.error('❌ Failed to create upload job:', err);
        process.exit(1);
    }

    const jobData = await jobRes.json();
    const jobId = jobData.data.id;
    console.log(`✅ Job Created! ID: ${jobId}`);

    console.log(`\n🚀 Step 2: Uploading Images (Sequential to protect Cloud Run limits)...`);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const fileName = path.basename(filePath);
        process.stdout.write(`[${i + 1}/${files.length}] Uploading ${fileName}... `);

        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));

        try {
            const uploadRes = await fetch(`${API_BASE_URL}/pilot/upload-jobs/${jobId}/files`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData
            });

            if (uploadRes.ok) {
                console.log('✅ OK (AI Processing Started)');
                successCount++;
            } else {
                console.log(`❌ Failed (${uploadRes.statusText})`);
                failCount++;
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            failCount++;
        }
    }

    console.log('\n=============================================');
    console.log(`🎉 BULK INGESTION COMPLETE`);
    console.log(`Successfully uploaded: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`\nThe Axis AI Pipeline is now analyzing these images in the background.`);
    console.log(`Any faults detected will automatically be added to your proprietary Data Flywheel.`);
    console.log('=============================================');
    process.exit(0);
}

bulkIngest();
