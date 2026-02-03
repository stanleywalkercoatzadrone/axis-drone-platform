-- Migration: Add AI Daily Operational Summary Template
-- Description: Adds a structured prompt template for analyzing daily logs, costs, and overruns.

INSERT INTO ai_prompt_templates (name, version, template, description, variables) VALUES
(
    'daily_operational_summary',
    '1.0.0',
    'You are an expert project manager for a drone inspection enterprise. Analyze the following daily operational data and provide a concise executive summary.\n\nDate: {{date}}\nMission Data: {{mission_data}}\nDaily Logs: {{daily_logs}}\nTotal Daily Cost: ${{total_cost}}\n\nProvide your analysis in the following JSON format strictly:\n{\n  "workCompleted": "A concise summary of what was accomplished today.",\n  "financialStatus": "Total cost for today and cumulative mission cost if available.",\n  "overrunAlerts": "Identify any possible cost overruns, time delays, or resource inefficiencies. If none, state ''None''.",\n  "recommendations": "Actionable steps for tomorrow to maintain schedule/budget."\n}',
    'Template for generating daily executive summaries of drone operations',
    '["date", "mission_data", "daily_logs", "total_cost"]'::jsonb
) ON CONFLICT (name, version) DO UPDATE SET template = EXCLUDED.template;
