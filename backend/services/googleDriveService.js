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
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly'
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
        'SELECT drive_access_token, drive_refresh_token FROM users WHERE id = $1',
        [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].drive_access_token) {
        throw new AppError('Google Drive not linked', 400);
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

export const findOrCreateFolder = async (userId, folderName, parentFolderId = null) => {
    try {
        const auth = await getAuthenticatedClient(userId);
        const drive = google.drive({ version: 'v3', auth });

        // Build query — scope to parent if given
        const parentClause = parentFolderId
            ? ` and '${parentFolderId}' in parents`
            : ` and 'root' in parents`;

        const response = await drive.files.list({
            q: `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`,
            fields: 'files(id, name)',
            spaces: 'drive',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        if (response.data.files && response.data.files.length > 0) {
            return response.data.files[0];
        }

        // Create it under the parent (or root)
        return await createFolder(userId, folderName, parentFolderId);
    } catch (error) {
        console.error('Error finding/creating folder:', error);
        throw new AppError('Failed to access Google Drive folder', 500);
    }
};

/**
 * Recursively find-or-create a chain of nested folders, then upload a file into the deepest one.
 *
 * @param {string}   userId        - user whose Drive token to use (admin's)
 * @param {string[]} folderPath    - e.g. ['Mission Alpha', 'Block_A1', 'Day-2']
 * @param {object}   file          - multer file object {buffer, mimetype, originalname}
 * @param {string}   fileName      - final filename in Drive
 * @returns {object} Drive file metadata {id, name, webViewLink}
 */
export const uploadToDriveStructured = async (userId, folderPath, file, fileName, baseFolderId = null) => {
    const auth = await getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    // Walk/create the folder chain
    let parentId = baseFolderId;
    for (const segment of folderPath) {
        const parentClause = parentId
            ? ` and '${parentId}' in parents`
            : ` and 'root' in parents`;

        const search = await drive.files.list({
            q: `name='${segment.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`,
            fields: 'files(id, name)',
            spaces: 'drive',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        if (search.data.files && search.data.files.length > 0) {
            parentId = search.data.files[0].id;
        } else {
            const meta = {
                name: segment,
                mimeType: 'application/vnd.google-apps.folder',
                ...(parentId && { parents: [parentId] })
            };
            const created = await drive.files.create({ requestBody: meta, fields: 'id, name', supportsAllDrives: true });
            parentId = created.data.id;
        }
    }

    // Upload file into the deepest folder
    const fileMetadata = {
        name: fileName,
        ...(parentId && { parents: [parentId] })
    };
    const { Readable } = await import('stream');
    const media = {
        mimeType: file.mimetype || 'application/octet-stream',
        body: file.buffer ? Readable.from(file.buffer) : file
    };

    const response = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true
    });

    return response.data;
};

export const listFiles = async (userId, parentFolderId = 'root') => {
    try {
        const auth = await getAuthenticatedClient(userId);
        const drive = google.drive({ version: 'v3', auth });

        const response = await drive.files.list({
            q: `'${parentFolderId}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType, iconLink, thumbnailLink, size, modifiedTime)',
            orderBy: 'folder, modifiedTime desc',
            spaces: 'drive',
            pageSize: 100,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        return response.data.files;
    } catch (error) {
        console.error('Error listing Drive files:', error);
        throw new AppError('Failed to fetch files from Google Drive', 500);
    }
};

export const importFile = async (userId, fileId) => {
    try {
        const auth = await getAuthenticatedClient(userId);
        const drive = google.drive({ version: 'v3', auth });

        // First get metadata to know filename and mimeType
        const metadata = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, mimeType, size'
        });

        // Get the file as a stream
        const response = await drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, { responseType: 'stream' });

        return {
            metadata: metadata.data,
            stream: response.data
        };
    } catch (error) {
        console.error('Error importing from Drive:', error);
        throw new AppError('Failed to import file from Google Drive', 500);
    }
};
