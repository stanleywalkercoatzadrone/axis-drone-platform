import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
const SAMPLE_IMAGE_PATH = '/Users/Huvrs/.gemini/antigravity/brain/f24d6f3e-7441-44ee-8fdc-8e48d5973182/sample_w9_test_1771349665228.png';

async function testDirect() {
    try {
        console.log('🧪 Testing AI Extraction Logic Directly (Bypassing API)...');
        
        if (!apiKey) {
            console.error('❌ API Key missing');
            return;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
            Analyze this document image. Identify the document type and extract relevant data.

            Output JSON with these keys (use null if not found):
            - documentType: "Direct Deposit", "W9", "Driver License", "FAA License", "Insurance", "Passport", or "Other"
            
            Fields to extract:
            - bankName, routingNumber, accountNumber, swiftCode (for Banking)
            - taxClassification (e.g. "Individual", "C Corp", "S Corp", "LLC") (for W9)
            - expirationDate (YYYY-MM-DD) (for Licenses/Insurance)
            - licenseNumber (for Licenses)
            - homeAddress (Full address string)
            - city, state, zipCode, country (Structured address parts)
            - name (Person name found)
            - businessName (Business name found)

            Return ONLY the valid JSON object.
        `;

        const buffer = fs.readFileSync(SAMPLE_IMAGE_PATH);
        const image = {
            inlineData: {
                data: buffer.toString('base64'),
                mimeType: 'image/png',
            },
        };

        console.log('📡 Sending document to Gemini...');
        const result = await model.generateContent([prompt, image]);
        const response = await result.response;
        const text = response.text();

        console.log('✅ Response received!');
        const jsonStr = text.replace(/\`\`\`json\s*/g, '').replace(/\`\`\`/g, '').trim();
        const extractedData = JSON.parse(jsonStr);

        console.log('📊 Extracted Data:');
        console.log(JSON.stringify(extractedData, null, 2));

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testDirect();
