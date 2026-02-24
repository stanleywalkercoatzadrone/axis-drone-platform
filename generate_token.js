
import jwt from 'jsonwebtoken';

const JWT_SECRET = '6fd725ae-ebdd-4390-bd39-fb08e14d085d';
const JWT_ISS = 'axis-drone-platform';
const JWT_AUD = 'axis-drone-client';

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
