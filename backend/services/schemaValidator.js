/**
 * Schema Validator
 * Validates AI outputs against predefined JSON schemas
 */

import { logger } from './logger.js';

/**
 * Schema definitions for AI outputs
 */
const SCHEMAS = {
    inspectionAnalysis: {
        type: 'object',
        required: ['findings', 'severity', 'riskScore', 'recommendations'],
        properties: {
            findings: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['id', 'type', 'severity', 'description'],
                    properties: {
                        id: { type: 'string' },
                        type: { type: 'string' },
                        severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                        description: { type: 'string' },
                        location: { type: 'string' },
                        confidence: { type: 'number', minimum: 0, maximum: 1 }
                    }
                }
            },
            severity: {
                type: 'string',
                enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
            },
            riskScore: {
                type: 'number',
                minimum: 0,
                maximum: 100
            },
            recommendations: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['priority', 'action', 'rationale'],
                    properties: {
                        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
                        action: { type: 'string' },
                        rationale: { type: 'string' },
                        estimatedCost: { type: 'number', minimum: 0 }
                    }
                }
            }
        }
    },

    anomalyDetection: {
        type: 'object',
        required: ['anomalies', 'overallRisk'],
        properties: {
            anomalies: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['type', 'severity', 'confidence', 'description'],
                    properties: {
                        type: { type: 'string' },
                        severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                        confidence: { type: 'number', minimum: 0, maximum: 1 },
                        description: { type: 'string' },
                        location: { type: 'object' }
                    }
                }
            },
            overallRisk: {
                type: 'string',
                enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
            }
        }
    },

    missionReadiness: {
        type: 'object',
        required: ['ready', 'riskFlags', 'score'],
        properties: {
            ready: { type: 'boolean' },
            score: { type: 'number', minimum: 0, maximum: 100 },
            riskFlags: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['category', 'severity', 'description'],
                    properties: {
                        category: { type: 'string' },
                        severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                        description: { type: 'string' },
                        mitigation: { type: 'string' }
                    }
                }
            },
            recommendations: {
                type: 'array',
                items: { type: 'string' }
            }
        }
    }
};

/**
 * Validate value against schema
 */
function validateValue(value, schema, path = '') {
    const errors = [];

    // Type validation
    if (schema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== schema.type) {
            errors.push(`${path}: Expected type ${schema.type}, got ${actualType}`);
            return errors; // Stop further validation if type is wrong
        }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: Value must be one of [${schema.enum.join(', ')}], got ${value}`);
    }

    // Number constraints
    if (schema.type === 'number') {
        if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push(`${path}: Value ${value} is less than minimum ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push(`${path}: Value ${value} is greater than maximum ${schema.maximum}`);
        }
    }

    // String constraints
    if (schema.type === 'string') {
        if (schema.minLength && value.length < schema.minLength) {
            errors.push(`${path}: String length ${value.length} is less than minimum ${schema.minLength}`);
        }
        if (schema.maxLength && value.length > schema.maxLength) {
            errors.push(`${path}: String length ${value.length} is greater than maximum ${schema.maxLength}`);
        }
    }

    // Array validation
    if (schema.type === 'array') {
        if (schema.items) {
            value.forEach((item, index) => {
                const itemErrors = validateValue(item, schema.items, `${path}[${index}]`);
                errors.push(...itemErrors);
            });
        }
        if (schema.minItems && value.length < schema.minItems) {
            errors.push(`${path}: Array length ${value.length} is less than minimum ${schema.minItems}`);
        }
        if (schema.maxItems && value.length > schema.maxItems) {
            errors.push(`${path}: Array length ${value.length} is greater than maximum ${schema.maxItems}`);
        }
    }

    // Object validation
    if (schema.type === 'object') {
        // Required properties
        if (schema.required) {
            for (const requiredProp of schema.required) {
                if (!(requiredProp in value)) {
                    errors.push(`${path}: Missing required property '${requiredProp}'`);
                }
            }
        }

        // Validate properties
        if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                if (propName in value) {
                    const propPath = path ? `${path}.${propName}` : propName;
                    const propErrors = validateValue(value[propName], propSchema, propPath);
                    errors.push(...propErrors);
                }
            }
        }
    }

    return errors;
}

/**
 * Validate data against named schema
 */
export function validate(schemaName, data) {
    const schema = SCHEMAS[schemaName];

    if (!schema) {
        throw new Error(`Unknown schema: ${schemaName}`);
    }

    const errors = validateValue(data, schema, schemaName);

    if (errors.length > 0) {
        logger.warn('Schema validation failed', {
            schemaName,
            errors,
            data: JSON.stringify(data).substring(0, 500)
        });

        return {
            valid: false,
            errors
        };
    }

    return {
        valid: true,
        errors: []
    };
}

/**
 * Validate and throw if invalid
 */
export function validateOrThrow(schemaName, data) {
    const result = validate(schemaName, data);

    if (!result.valid) {
        throw new Error(`Schema validation failed: ${result.errors.join('; ')}`);
    }

    return true;
}

/**
 * Get available schemas
 */
export function getSchemas() {
    return Object.keys(SCHEMAS);
}

/**
 * Add custom schema
 */
export function addSchema(name, schema) {
    if (SCHEMAS[name]) {
        logger.warn(`Overwriting existing schema: ${name}`);
    }
    SCHEMAS[name] = schema;
}

export default { validate, validateOrThrow, getSchemas, addSchema };
