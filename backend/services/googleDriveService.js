import { google } from 'googleapis';
import { Readable } from 'stream';
import { AppError } from '../middleware/errorHandler.js';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/api/auth/google/callback'
);

export const getAuthUrl = () => {
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.file'
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });
};

export const getTokensFromCode = async (code) => {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    } catch (error) {
        console.error('Error getting tokens:', error);
        throw new AppError('Failed to authenticate with Google', 400);
    }
};

export const getUserInfo = async (accessToken) => {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();
        return data;
    } catch (error) {
        console.error('Error getting user info:', error);
        throw new AppError('Failed to get user information', 400);
    }
};

export const uploadToDrive = async (accessToken, refreshToken, file, fileName, folderId = null) => {
    try {
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const fileMetadata = {
            name: fileName,
            ...(folderId && { parents: [folderId] })
        };

        const media = {
            mimeType: file.mimetype || 'application/octet-stream',
            body: file.buffer ? Readable.from(file.buffer) : file
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink'
        });

        return response.data;
    } catch (error) {
        console.error('Error uploading to Drive:', error);
        throw new AppError('Failed to upload file to Google Drive', 500);
    }
};

export const createFolder = async (accessToken, refreshToken, folderName, parentFolderId = null) => {
    try {
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            ...(parentFolderId && { parents: [parentFolderId] })
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id, name, webViewLink'
        });

        return response.data;
    } catch (error) {
        console.error('Error creating folder:', error);
        throw new AppError('Failed to create folder in Google Drive', 500);
    }
};

export const findOrCreateFolder = async (accessToken, refreshToken, folderName) => {
    try {
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Search for existing folder
        const response = await drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.data.files && response.data.files.length > 0) {
            return response.data.files[0];
        }

        // Create folder if not found
        return await createFolder(accessToken, refreshToken, folderName);
    } catch (error) {
        console.error('Error finding/creating folder:', error);
        throw new AppError('Failed to access Google Drive folder', 500);
    }
};
