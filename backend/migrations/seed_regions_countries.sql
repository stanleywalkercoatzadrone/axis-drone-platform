-- Seed regions
INSERT INTO regions (name) VALUES
  ('North America'),('Central America'),('South America'),
  ('Caribbean'),('Europe'),('Asia Pacific')
ON CONFLICT (name) DO NOTHING;

-- Seed countries
WITH rm AS (SELECT id, name FROM regions)
INSERT INTO countries (region_id, name, iso_code, currency, units_of_measurement, status)
SELECT r.id, c.name, c.iso, c.currency, c.units, 'ENABLED'
FROM rm r
JOIN (VALUES
  -- North America
  ('North America','United States','US','USD','imperial'),
  ('North America','Canada','CA','CAD','metric'),
  ('North America','Mexico','MX','MXN','metric'),
  -- Central America
  ('Central America','Guatemala','GT','GTQ','metric'),
  ('Central America','Belize','BZ','BZD','metric'),
  ('Central America','Honduras','HN','HNL','metric'),
  ('Central America','El Salvador','SV','USD','metric'),
  ('Central America','Nicaragua','NI','NIO','metric'),
  ('Central America','Costa Rica','CR','CRC','metric'),
  ('Central America','Panama','PA','PAB','metric'),
  -- South America
  ('South America','Colombia','CO','COP','metric'),
  ('South America','Venezuela','VE','VES','metric'),
  ('South America','Brazil','BR','BRL','metric'),
  ('South America','Peru','PE','PEN','metric'),
  ('South America','Ecuador','EC','USD','metric'),
  ('South America','Bolivia','BO','BOB','metric'),
  ('South America','Chile','CL','CLP','metric'),
  ('South America','Argentina','AR','ARS','metric'),
  ('South America','Paraguay','PY','PYG','metric'),
  ('South America','Uruguay','UY','UYU','metric'),
  -- Caribbean
  ('Caribbean','Cuba','CU','CUP','metric'),
  ('Caribbean','Dominican Republic','DO','DOP','metric'),
  ('Caribbean','Puerto Rico','PR','USD','imperial'),
  ('Caribbean','Jamaica','JM','JMD','metric'),
  ('Caribbean','Trinidad and Tobago','TT','TTD','metric'),
  -- Europe
  ('Europe','United Kingdom','GB','GBP','metric'),
  ('Europe','Germany','DE','EUR','metric'),
  ('Europe','France','FR','EUR','metric'),
  ('Europe','Spain','ES','EUR','metric'),
  ('Europe','Netherlands','NL','EUR','metric'),
  -- Asia Pacific
  ('Asia Pacific','Australia','AU','AUD','metric'),
  ('Asia Pacific','Japan','JP','JPY','metric'),
  ('Asia Pacific','Singapore','SG','SGD','metric')
) AS c(region, name, iso, currency, units) ON r.name = c.region
ON CONFLICT (iso_code) DO NOTHING;

-- Verify
SELECT COUNT(*) AS total_countries FROM countries;
SELECT COUNT(*) AS total_regions FROM regions;
