/**
 * Service Registry — Axis Enterprise Platform
 *
 * Singleton service locator that allows decoupled access to core services
 * without tight import coupling. Prepares the architecture for future
 * microservice extraction (ENABLE_MICROSERVICES flag) and DI patterns.
 *
 * Usage:
 *   import { registry } from '../core/serviceRegistry.js';
 *   const ai = registry.get('ai');
 *   await ai.analyzeInspection(data, userId);
 *
 * NOTE: Services are lazily loaded on first access to avoid circular imports.
 */

class ServiceRegistry {
    constructor() {
        this._services = new Map();
        this._factories = new Map();
    }

    /**
     * Register a service factory (lazy initialization).
     * @param {string} name - Service identifier
     * @param {Function} factory - Async or sync factory returning the service instance
     */
    register(name, factory) {
        if (this._factories.has(name)) {
            console.warn(`[ServiceRegistry] Overwriting existing factory for: ${name}`);
        }
        this._factories.set(name, factory);
    }

    /**
     * Get a registered service instance. Initializes on first access.
     * @param {string} name - Service identifier
     * @returns {any} Service instance
     */
    async get(name) {
        if (this._services.has(name)) {
            return this._services.get(name);
        }

        const factory = this._factories.get(name);
        if (!factory) {
            throw new Error(`[ServiceRegistry] Unknown service: '${name}'. Did you register it?`);
        }

        const instance = await factory();
        this._services.set(name, instance);
        return instance;
    }

    /**
     * Synchronous get — use only when you know the service is already initialized.
     * Throws if the service hasn't been initialized yet.
     */
    getSync(name) {
        if (!this._services.has(name)) {
            throw new Error(`[ServiceRegistry] Service '${name}' not yet initialized. Use async get() first.`);
        }
        return this._services.get(name);
    }

    /**
     * Check if a service is registered (not necessarily initialized).
     */
    has(name) {
        return this._factories.has(name) || this._services.has(name);
    }

    /**
     * List all registered service names (for health checks / debugging).
     */
    list() {
        return [...new Set([...this._factories.keys(), ...this._services.keys()])];
    }
}

// Singleton registry instance
const registry = new ServiceRegistry();

// ── Register core services (lazy factories) ───────────────────────────────────

registry.register('ai', async () => {
    const { aiService } = await import('../services/aiService.js');
    return aiService;
});

registry.register('gemini', async () => {
    const { geminiService } = await import('../services/geminiService.js');
    return geminiService;
});

registry.register('storage', async () => {
    // storageService exports individual functions, not a class — return module
    return import('../services/storageService.js');
});

registry.register('email', async () => {
    return import('../services/emailService.js');
});

registry.register('permissions', async () => {
    return import('../services/permissionService.js');
});

registry.register('logger', async () => {
    const { logger } = await import('../services/logger.js');
    return logger;
});

console.log(`📦 ServiceRegistry initialized with ${registry.list().length} service factories`);

export { registry, ServiceRegistry };
