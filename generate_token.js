
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISS = 'axis-drone-platform';
const JWT_AUD = 'axis-drone-client';

if (!JWT_SECRET) {
    console.error('JWT_SECRET is required to generate a token.');
    process.exit(1);
}

const token = jwt.sign(
    {
        id: 'system-admin',
        role: 'admin',
        auth_version: 1
    },
    JWT_SECRET,
    {
        algorithm: 'HS256',
        issuer: JWT_ISS,
        audience: JWT_AUD,
        expiresIn: '1h'
    }
);

console.log(token);
