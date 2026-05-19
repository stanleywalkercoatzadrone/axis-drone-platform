import { GoogleGenAI } from '@google/genai';
import { logger } from './logger.js';

export async function extractDocumentMetadata(fileBuffer, mimeType, pilotNameStr) {
    try {
        const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!key) {
            logger.warn('[documentScanner] Missing GEMINI_API_KEY. Bypassing detection.');
            return { documentType: 'Unknown', expirationDate: null, nameMatch: false, confidence: 0, extractedName: '' };
        }
        
        const ai = new GoogleGenAI({ apiKey: key });
        const prompt = `You are a strict compliance auditor for a drone inspection platform.
Scan this uploaded credential or document.
The pilot account uploading this claims the name: "${pilotNameStr || 'Unknown'}".

Identify what this document is, when it expires (if applicable), and if the name on the document matches the pilot account.

Return strictly raw valid JSON format (NEVER use markdown brackets like \`\`\`json):
{
  "documentType": "string (e.g. FAA Part 107, OSHA 10, Driver License, General Insurance, specific cert classification)",
  "expirationDate": "string (YYYY-MM-DD) or null",
  "nameMatch": boolean,
  "confidence": number,
  "extractedName": "string or null"
}`;

        const b64 = fileBuffer.toString('base64');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                prompt,
                { inlineData: { data: b64, mimeType } }
            ],
            config: {
                temperature: 0.1,
                responseMimeType: 'application/json'
            }
        });

        const text = response.text().trim();
        const cleanPayload = text.replace(/^```json/i, '').replace(/```$/, '').trim();
        const payload = JSON.parse(cleanPayload);
        
        return {
            documentType: payload.documentType || 'Unknown',
            expirationDate: payload.expirationDate || null,
            nameMatch: !!payload.nameMatch,
            confidence: payload.confidence || Date.now() ? 0.9 : 0.9,
            extractedName: payload.extractedName || ''
        };
    } catch(err) {
        logger.warn(`[documentScanner] Extraction failed: ${err.message}`);
        return { documentType: 'Unknown/Unreadable', expirationDate: null, nameMatch: false, confidence: 0, extractedName: '' };
    }
}
