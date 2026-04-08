import db from '../config/database.js';
import { uploadFile } from '../services/storageService.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';

export const getMyDocuments = async (req, res) => {
    try {
        const email = req.user.email;
        const personnelRes = await db.query('SELECT id FROM personnel WHERE email = $1', [email]);
        
        if (personnelRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Personnel record not found' });
        }
        
        const personnelId = personnelRes.rows[0].id;

        const docResult = await db.query(
            `SELECT 
                id,
                personnel_id as pilot_id,
                category as document_type,
                url as file_url,
                'VALID' as validation_status,
                created_at as uploaded_at,
                updated_at,
                expiration_date
             FROM pilot_documents
             WHERE personnel_id = $1
             ORDER BY created_at DESC`,
            [personnelId]
        );

        res.status(200).json({
            success: true,
            data: docResult.rows
        });
    } catch (error) {
        console.error('Error fetching my documents:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch documents' });
    }
};

export const uploadMyDocument = async (req, res) => {
    try {
        const email = req.user.email;
        const personnelRes = await db.query('SELECT id FROM personnel WHERE email = $1', [email]);
        
        if (personnelRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Personnel record not found' });
        }
        
        const personnelId = personnelRes.rows[0].id;
        const { documentType, expirationDate } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        let webViewLink = null;
        try {
            const uploadResult = await uploadFile(file, 'pilots');
            webViewLink = uploadResult.url;
        } catch (storageError) {
            return res.status(500).json({ success: false, message: 'Storage Upload Failed' });
        }

        let finalDocumentType = documentType || 'Other';

        // Basic AI if enabled
        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const prompt = `Analyze this document image. Extract {"documentType": "type"}. Try to classify into Flight Logs, Certification, License, W9, Insurance, Photo ID, Other.`;
                const image = { inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } };
                const result = await model.generateContent([prompt, image]);
                const text = result.response.text();
                const jsonStr = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
                const extractedData = JSON.parse(jsonStr);
                if (extractedData.documentType) finalDocumentType = extractedData.documentType;
            } catch (err) { }
        }

        const docResult = await db.query(
            `INSERT INTO pilot_documents(personnel_id, category, name, url, expiration_date)
             VALUES($1, $2, $3, $4, $5)
             RETURNING *, category as document_type, url as file_url, created_at as uploaded_at, 'VALID' as validation_status`,
            [
                personnelId,
                finalDocumentType,
                file.originalname,
                webViewLink,
                expirationDate || null
            ]
        );

        res.status(201).json({
            success: true,
            data: docResult.rows[0]
        });
    } catch (error) {
        console.error('Error in uploadMyDocument:', error);
        res.status(500).json({ success: false, message: 'Upload Failed' });
    }
};
