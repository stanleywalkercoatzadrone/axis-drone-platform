import db from '../config/database.js';

/**
 * Pricing Controller
 * Handles mission pricing calculations, profit forecasting, and regional adjustments
 */

export const calculateMissionPricing = async (req, res) => {
    try {
        const { deploymentId, markupOverride, regionalMultiplierOverride } = req.body;

        // 1. Fetch deployment and assigned personnel
        const deploymentRes = await db.query(
            `SELECT d.*, c.name as client_name, s.name as site_name 
             FROM deployments d
             LEFT JOIN sites s ON d.site_id = s.id
             LEFT JOIN clients c ON COALESCE(d.client_id, s.client_id) = c.id
             WHERE d.id = $1`,
            [deploymentId]
        );

        if (deploymentRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Deployment not found' });
        }

        const deployment = deploymentRes.rows[0];

        // 2. Get assigned pilots and their rates
        const personnelRes = await db.query(
            `SELECT p.id, p.full_name, p.daily_pay_rate 
             FROM personnel p
             JOIN deployment_personnel dp ON p.id = dp.personnel_id
             WHERE dp.deployment_id = $1`,
            [deploymentId]
        );

        const pilots = personnelRes.rows;
        const totalPilotDailyCost = pilots.reduce((sum, p) => sum + parseFloat(p.daily_pay_rate || 0), 0);

        // 3. Get regional cost factors (simple match by location or default)
        // For now, look for a region name in the location string or use 'Default'
        const regionRes = await db.query(
            `SELECT * FROM regional_cost_factors 
             WHERE $1 ILIKE '%' || region_name || '%' 
             LIMIT 1`,
            [deployment.location || '']
        );

        const region = regionRes.rows[0] || { labor_multiplier: 1.0, lodging_daily_rate: 150.0 };
        const laborMultiplier = regionalMultiplierOverride || parseFloat(region.labor_multiplier);

        // 4. Calculate total base cost
        const days = deployment.days_on_site || 1;
        const baseLaborCost = totalPilotDailyCost * days * laborMultiplier;
        const lodgingCost = region.lodging_daily_rate * days * pilots.length;

        const totalBaseCost = baseLaborCost + lodgingCost + parseFloat(deployment.travel_costs || 0) + parseFloat(deployment.equipment_costs || 0);

        // 5. Calculate recommended client price
        const markup = markupOverride !== undefined ? markupOverride : parseFloat(deployment.markup_percentage || 30);
        const recommendedPrice = totalBaseCost * (1 + (markup / 100));

        const pricingData = {
            deploymentId,
            calculation: {
                laborCost: baseLaborCost,
                lodgingCost: lodgingCost,
                travelCost: parseFloat(deployment.travel_costs || 0),
                equipmentCost: parseFloat(deployment.equipment_costs || 0),
                totalBaseCost: totalBaseCost
            },
            recommendation: {
                markupPercentage: markup,
                recommendedPrice: recommendedPrice,
                estimatedProfit: recommendedPrice - totalBaseCost,
                estimatedMargin: ((recommendedPrice - totalBaseCost) / recommendedPrice) * 100
            }
        };

        res.json({
            success: true,
            data: pricingData
        });
    } catch (error) {
        console.error('Pricing calculation error:', error);
        res.status(500).json({ success: false, message: 'Failed to calculate pricing' });
    }
};

export const updateMissionPricing = async (req, res) => {
    try {
        const { id } = req.params;
        const { baseCost, markupPercentage, clientPrice, travelCosts, equipmentCosts } = req.body;

        const result = await db.query(
            `UPDATE deployments 
             SET base_cost = $1, 
                 markup_percentage = $2, 
                 client_price = $3, 
                 travel_costs = $4, 
                 equipment_costs = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [baseCost, markupPercentage, clientPrice, travelCosts, equipmentCosts, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Deployment not found' });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Mission pricing updated successfully'
        });
    } catch (error) {
        console.error('Error updating mission pricing:', error);
        res.status(500).json({ success: false, message: 'Failed to update pricing' });
    }
};
