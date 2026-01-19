import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

let redisClient = null;
let isConnected = false;
const memoryCache = new Map();

// Try to connect to real Redis, fallback to memory
const initRedis = async () => {
    try {
        const client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: {
                connectTimeout: 2000,
                reconnectStrategy: false // Don't retry indefinitely
            }
        });

        client.on('error', (err) => {
            // Suppress errors after initial failure to prevent log spam
            if (isConnected) console.error('Redis error:', err.message);
        });

        await client.connect();
        redisClient = client;
        isConnected = true;
        console.log('✅ Redis connected');
    } catch (error) {
        console.log('⚠️  Redis unavailable - using in-memory fallback');
        isConnected = false;
    }
};

initRedis();

export const setCache = async (key, value, expirationInSeconds = 3600) => {
    if (isConnected && redisClient) {
        try {
            await redisClient.setEx(key, expirationInSeconds, JSON.stringify(value));
            return;
        } catch (e) { /* ignore */ }
    }
    // Fallback
    memoryCache.set(key, { value, expires: Date.now() + (expirationInSeconds * 1000) });
};

export const getCache = async (key) => {
    if (isConnected && redisClient) {
        try {
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (e) { /* ignore */ }
    }
    // Fallback
    const item = memoryCache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
        memoryCache.delete(key);
        return null;
    }
    return item.value;
};

export const deleteCache = async (key) => {
    if (isConnected && redisClient) {
        try {
            await redisClient.del(key);
        } catch (e) { /* ignore */ }
    }
    memoryCache.delete(key);
};

export const clearCachePattern = async (pattern) => {
    if (isConnected && redisClient) {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) await redisClient.del(keys);
        } catch (e) { /* ignore */ }
    }
    // Simple memory pattern match (supports * at end)
    if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        for (const key of memoryCache.keys()) {
            if (key.startsWith(prefix)) memoryCache.delete(key);
        }
    }
};

export default redisClient;
