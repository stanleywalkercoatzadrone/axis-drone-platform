import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '15m';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';

const JWT_ISS = process.env.JWT_ISS || 'axis-drone-platform';
const JWT_AUD = process.env.JWT_AUD || 'axis-drone-client';

export const generateToken = (userId, authVersion = 1) => {
    return jwt.sign(
        {
            id: userId,
            auth_version: authVersion,
            jti: uuidv4(),
            iss: JWT_ISS,
            aud: JWT_AUD
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRE }
    );
};

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';

export const generateRefreshToken = (userId, authVersion = 1, familyId = null) => {
    return jwt.sign(
        {
            id: userId,
            auth_version: authVersion,
            family_id: familyId || uuidv4(),
            type: 'refresh',
            jti: uuidv4(),
            iss: JWT_ISS,
            aud: JWT_AUD
        },
        JWT_REFRESH_SECRET,
        { expiresIn: JWT_REFRESH_EXPIRE }
    );
};

export const verifyToken = (token, secret = JWT_SECRET, options = {}) => {
    try {
        return jwt.verify(token, secret, {
            algorithms: ['HS256'],
            issuer: JWT_ISS,
            audience: JWT_AUD,
            ...options
        });
    } catch (error) {
        throw new Error('Invalid token');
    }
};

export const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

export const comparePassword = async (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword);
};

export const generateInvitationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};
