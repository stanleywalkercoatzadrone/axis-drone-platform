import { google } from 'googleapis';
import { Readable } from 'stream';
import { AppError } from '../middleware/errorHandler.js';
import { query } from '../config/database.js';

// Factory for OAuth2 Client to avoid shared state
const createOAuthClient = () => new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/api/auth/google/callback'
);

export const getAuthUrl = () => {
    const oauth2Client = createOAuthClient();
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
        const oauth2Client = createOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    } catch (error) {
        console.error('Error getting tokens:', error);
        throw new AppError('Failed to authenticate with Google', 400);
    }
};

export const getUserInfo = async (accessToken) => {
    try {
        const oauth2Client = createOAuthClient();
        oauth2Client.setCredentials({ access_token: accessToken });
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();
        return data;
    } catch (error) {
        console.error('Error getting user info:', error);
        throw new AppError('Failed to get user information', 400);
    }
};

// Helper: Get Authenticated Client for User with Auto-Refresh Handling
const getAuthenticatedClient = async (userId) => {
    // 1. Fetch tokens from DB
    const result = await query(
        'SELECT drive_access_token, drive_refresh_token, drive_expiry FROM users WHERE id = $1',
        [userId]
    );

    if (result.rows.length === 0 || (!result.rows[0].drive_access_token && !result.rows[0].drive_refresh_token)) {
        // Fallback or better error message:
        console.warn(`User ${userId} does not have Google Drive linked.`);
        throw new AppError('Google Drive not linked or token expired. Please reconnect Drive in Settings.', 401);
    }

    const { drive_access_token, drive_refresh_token } = result.rows[0];

    const oauth2Client = createOAuthClient();

    // 2. Set Credentials
    oauth2Client.setCredentials({
        access_token: drive_access_token,
        refresh_token: drive_refresh_token
    });

    // 3. Handle Token Refresh (Update DB if refreshed)
    oauth2Client.on('tokens', async (tokens) => {
        if (tokens.access_token) {
            console.log(`🔄 Refreshing Google Access Token for user ${userId}`);
            await query(
                `UPDATE users 
                 SET drive_access_token = $1, 
                     drive_refresh_token = COALESCE($2, drive_refresh_token) -- refresh_token might not be returned always
                 WHERE id = $3`,
                [tokens.access_token, tokens.refresh_token, userId]
            );
        }
    });

    return oauth2Client;
};

export const uploadToDrive = async (userId, file, fileName, folderId = null) => {
    try {
        const auth = await getAuthenticatedClient(userId);
        const drive = google.drive({ version: 'v3', auth });

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

export const createFolder = async (userId, folderName, parentFolderId = null) => {
    try {
        const auth = await getAuthenticatedClient(userId);
        const drive = google.drive({ version: 'v3', auth });

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

export const findOrCreateFolder = async (userId, folderName) => {
    try {
        const auth = await getAuthenticatedClient(userId);
        const drive = google.drive({ version: 'v3', auth });

        // Search for existing folder
        const response = await drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.data.files && response.data.files.length > 0) {
            return response.data.files[0];
        }

        // Create folder if not found (we can call createFolder directly but we need to pass userId)
        return await createFolder(userId, folderName);
    } catch (error) {
        console.error('Error finding/creating folder:', error);
        throw new AppError('Failed to access Google Drive folder', 500);
    }
};
