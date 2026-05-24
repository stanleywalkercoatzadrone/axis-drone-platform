-- Migration 030: Seed Major Solar Industry Clients
-- Seeds the top ~50 real-world solar companies as clients
-- These are global solar asset owners, developers, EPCs, O&M firms, and installers
-- that would realistically use drone inspection services

DO $$
DECLARE
  solar_industry_id UUID;
BEGIN
  -- Get solar industry ID
  SELECT id INTO solar_industry_id FROM industries WHERE key = 'solar' LIMIT 1;
  IF solar_industry_id IS NULL THEN
    INSERT INTO industries (key, name) VALUES ('solar', 'Solar') RETURNING id INTO solar_industry_id;
  END IF;

  -- Insert major solar companies (skip if name already exists for this tenant)
  INSERT INTO clients (industry_id, name, address, email, primary_contact_name, tenant_id, onboarding_status, onboarding_step)
  VALUES

  -- ── US Utility-Scale Asset Owners & IPPs ─────────────────────────────────
  (solar_industry_id, 'NextEra Energy Resources',
    '{"city":"Juno Beach","state":"FL","country":"United States","website":"nexteraenergy.com","type":"Utility-Scale Owner","description":"World''s largest generator of renewable wind and solar energy with 20+ GW of solar capacity."}',
    'contact@nexteraenergy.com', 'Director of Operations', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Clearway Energy Group',
    '{"city":"San Francisco","state":"CA","country":"United States","website":"clearwayenergy.com","type":"Utility-Scale Owner","description":"One of the largest renewable energy owners in the US with 8+ GW of wind and solar."}',
    'contact@clearwayenergy.com', 'Asset Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Invenergy',
    '{"city":"Chicago","state":"IL","country":"United States","website":"invenergy.com","type":"Developer-EPC","description":"One of the largest private renewable energy developers in North America with 35+ GW in operation and development."}',
    'contact@invenergy.com', 'VP Asset Management', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'AES Corporation',
    '{"city":"Arlington","state":"VA","country":"United States","website":"aes.com","type":"Utility-Scale Owner","description":"Global power company with a major solar portfolio spanning 14 countries and accelerating toward 100% clean energy."}',
    'contact@aes.com', 'Solar Asset Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Dominion Energy',
    '{"city":"Richmond","state":"VA","country":"United States","website":"dominionenergy.com","type":"Utility-Scale Owner","description":"Major US utility with a 35 GW solar buildout plan across the Southeast US."}',
    'contact@dominionenergy.com', 'Director of Solar Operations', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Duke Energy Renewables',
    '{"city":"Charlotte","state":"NC","country":"United States","website":"duke-energy.com","type":"Utility-Scale Owner","description":"One of the largest US utilities operating 6+ GW of solar and expanding rapidly."}',
    'contact@duke-energy.com', 'Renewables Asset Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Xcel Energy',
    '{"city":"Denver","state":"CO","country":"United States","website":"xcelenergy.com","type":"Utility-Scale Owner","description":"Upper Midwest utility with an aggressive 100% carbon-free electricity goal and major solar buildout."}',
    'contact@xcelenergy.com', 'Clean Energy Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Consolidated Edison',
    '{"city":"New York","state":"NY","country":"United States","website":"coned.com","type":"Utility-Scale Owner","description":"New York''s utility with significant solar development through its clean energy subsidiary Con Edison Clean Energy Businesses."}',
    'contact@coned.com', 'Director of Renewable Energy', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'PSEG Solar Source',
    '{"city":"Newark","state":"NJ","country":"United States","website":"pseg.com","type":"Utility-Scale Owner","description":"PSEG''s solar subsidiary managing 500+ MW of utility-scale and distributed solar across the US."}',
    'contact@pseg.com', 'Solar Portfolio Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Avangrid Renewables',
    '{"city":"Orange","state":"CT","country":"United States","website":"avangrid.com","type":"Developer-EPC","description":"US renewable arm of Iberdrola with 10+ GW of wind and solar in operation and development."}',
    'contact@avangrid.com', 'VP Renewable Operations', 'coatzadrone', 'IN_PROGRESS', 1),

  -- ── US Residential & Commercial Solar Installers ─────────────────────────
  (solar_industry_id, 'Sunrun',
    '{"city":"San Francisco","state":"CA","country":"United States","website":"sunrun.com","type":"Residential Installer","description":"Largest US residential solar installer with 900,000+ customers and 6+ GW of installed solar+storage."}',
    'contact@sunrun.com', 'Operations Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Sunnova Energy',
    '{"city":"Houston","state":"TX","country":"United States","website":"sunnova.com","type":"Residential Installer","description":"National residential solar and storage service provider with 400,000+ customers across 40+ US states."}',
    'contact@sunnova.com', 'Asset Management Lead', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'SunPower Corporation',
    '{"city":"San Jose","state":"CA","country":"United States","website":"sunpower.com","type":"Commercial","description":"Premium US solar manufacturer and installer serving residential and commercial markets with high-efficiency panels."}',
    'contact@sunpower.com', 'Commercial Sales Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Altus Power',
    '{"city":"Stamford","state":"CT","country":"United States","website":"altuspower.com","type":"Commercial","description":"Leading US commercial-scale clean electrification company with 1+ GW of solar serving commercial clients."}',
    'contact@altuspower.com', 'Portfolio Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Sol Systems',
    '{"city":"Washington","state":"DC","country":"United States","website":"solsystems.com","type":"Developer-EPC","description":"Full-service solar energy firm managing development, financing, and long-term asset management for solar projects."}',
    'contact@solsystems.com', 'Director of Project Development', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Greenbacker Renewable Energy',
    '{"city":"New York","state":"NY","country":"United States","website":"greenbackercapital.com","type":"Utility-Scale Owner","description":"Publicly-listed renewable energy company owning and operating utility-scale solar across North America."}',
    'contact@greenbackercapital.com', 'Asset Operations Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Cypress Creek Renewables',
    '{"city":"Chapel Hill","state":"NC","country":"United States","website":"ccrenew.com","type":"Developer-EPC","description":"Major US community and utility-scale solar developer with 3+ GW in operation and strong Southeast presence."}',
    'contact@ccrenew.com', 'VP of O&M', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Hannon Armstrong',
    '{"city":"Annapolis","state":"MD","country":"United States","website":"hannonarmstrong.com","type":"Utility-Scale Owner","description":"Climate-positive investment firm owning solar and wind assets totaling 5+ GW across the United States."}',
    'contact@hannonarmstrong.com', 'Asset Management Director', 'coatzadrone', 'IN_PROGRESS', 1),

  -- ── US Solar Manufacturers & Technology ──────────────────────────────────
  (solar_industry_id, 'First Solar',
    '{"city":"Tempe","state":"AZ","country":"United States","website":"firstsolar.com","type":"Manufacturer","description":"Leading US-based thin-film solar panel manufacturer and developer with 20+ GW of utility-scale projects globally."}',
    'contact@firstsolar.com', 'Project Development Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Array Technologies',
    '{"city":"Albuquerque","state":"NM","country":"United States","website":"arraytechinc.com","type":"Manufacturer","description":"World''s largest solar tracking manufacturer with trackers deployed on 30+ GW of solar projects globally."}',
    'contact@arraytechinc.com', 'Field Services Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Nextracker',
    '{"city":"Fremont","state":"CA","country":"United States","website":"nextracker.com","type":"Manufacturer","description":"Global leader in intelligent solar tracker systems with 70+ GW of trackers shipped worldwide."}',
    'contact@nextracker.com', 'Global Services Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Tesla Energy',
    '{"city":"Austin","state":"TX","country":"United States","website":"tesla.com/energy","type":"Commercial","description":"Tesla''s energy division deploying solar panels, Powerwall, Powerpack and Megapack at residential, commercial and grid scale."}',
    'contact@tesla.com', 'Energy Operations Lead', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Enphase Energy',
    '{"city":"Fremont","state":"CA","country":"United States","website":"enphase.com","type":"Manufacturer","description":"World''s #1 microinverter company powering 3+ million homes in 145+ countries with solar microinverters and energy storage."}',
    'contact@enphase.com', 'Field Operations Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  -- ── European Utility-Scale Developers ────────────────────────────────────
  (solar_industry_id, 'Ørsted',
    '{"city":"Fredericia","state":"Jutland","country":"Denmark","website":"orsted.com","type":"Developer-EPC","description":"Global leader in renewable energy development transitioning from fossil fuels with major solar and offshore wind portfolios."}',
    'contact@orsted.com', 'Solar Asset Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'RWE Renewables',
    '{"city":"Essen","state":"North Rhine-Westphalia","country":"Germany","website":"rwe.com","type":"Utility-Scale Owner","description":"One of the world''s largest renewable energy companies with 10+ GW solar capacity and €50B green investment plan."}',
    'contact@rwe.com', 'Solar Portfolio Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Enel Green Power',
    '{"city":"Rome","state":"Lazio","country":"Italy","website":"enelgreenpower.com","type":"Utility-Scale Owner","description":"World''s largest private renewable energy operator with 60+ GW of renewables including 20+ GW of solar globally."}',
    'contact@enelgreenpower.com', 'Asset Management Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Iberdrola',
    '{"city":"Bilbao","state":"Basque Country","country":"Spain","website":"iberdrola.com","type":"Utility-Scale Owner","description":"Global energy major with €150B clean investment plan and 20+ GW of solar across Spain, US, Brazil and UK."}',
    'contact@iberdrola.com', 'Renewables Operations Lead', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'EDP Renewables',
    '{"city":"Oviedo","state":"Asturias","country":"Spain","website":"edpr.com","type":"Developer-EPC","description":"One of Europe''s largest renewable energy developers with 7+ GW of solar in operation across 4 continents."}',
    'contact@edpr.com', 'Solar Asset Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Acciona Energy',
    '{"city":"Alcobendas","state":"Madrid","country":"Spain","website":"acciona.com","type":"Utility-Scale Owner","description":"Major Spanish renewable energy conglomerate with 12+ GW of solar and wind globally and strong Latin America presence."}',
    'contact@acciona.com', 'Director of Solar Assets', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'BayWa r.e.',
    '{"city":"Munich","state":"Bavaria","country":"Germany","website":"baywa-re.com","type":"Developer-EPC","description":"Leading global renewable energy developer with 5+ GW of solar in development and operation across 30+ countries."}',
    'contact@baywa-re.com', 'Project Development Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Statkraft',
    '{"city":"Oslo","state":"Oslo","country":"Norway","website":"statkraft.com","type":"Developer-EPC","description":"Europe''s largest renewable energy producer with solar projects spanning Europe, South America and India."}',
    'contact@statkraft.com', 'Solar Asset Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Lightsource bp',
    '{"city":"London","state":"England","country":"United Kingdom","website":"lightsourcebp.com","type":"Developer-EPC","description":"Global solar developer backed by bp with 25+ GW in development across Europe, Americas, India and Australia."}',
    'contact@lightsourcebp.com', 'VP Asset Management', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'X-ELIO',
    '{"city":"Madrid","state":"Madrid","country":"Spain","website":"x-elio.com","type":"Developer-EPC","description":"International solar developer with 3+ GW in operation and development across Spain, US, Latin America and Africa."}',
    'contact@x-elio.com', 'Operations Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Solarpack',
    '{"city":"Vitoria-Gasteiz","state":"Basque Country","country":"Spain","website":"solarpack.es","type":"Developer-EPC","description":"Multinational solar developer with 2+ GW in operation across Spain, Chile, Peru, India, and Southeast Asia."}',
    'contact@solarpack.es', 'Asset Management Lead', 'coatzadrone', 'IN_PROGRESS', 1),

  -- ── Oil & Gas Companies with Solar Divisions ─────────────────────────────
  (solar_industry_id, 'BP Solar',
    '{"city":"London","state":"England","country":"United Kingdom","website":"bp.com","type":"Developer-EPC","description":"BP''s renewables arm with 50+ GW of solar in development globally through Lightsource bp and direct investments."}',
    'contact@bp.com', 'Head of Solar Development', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Shell Energy',
    '{"city":"The Hague","state":"South Holland","country":"Netherlands","website":"shell.com","type":"Utility-Scale Owner","description":"Shell''s energy transition arm with solar projects in US, Europe, India and Brazil as part of its net-zero strategy."}',
    'contact@shell.com', 'Renewables Asset Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'TotalEnergies Renewables',
    '{"city":"Paris","state":"Île-de-France","country":"France","website":"totalenergies.com","type":"Utility-Scale Owner","description":"Major European oil major with 35+ GW of solar in operation and development targeting 100 GW by 2030."}',
    'contact@totalenergies.com', 'Solar Portfolio Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  -- ── Asian Solar Manufacturers & Developers ───────────────────────────────
  (solar_industry_id, 'Canadian Solar',
    '{"city":"Guelph","state":"Ontario","country":"Canada","website":"canadiansolar.com","type":"Manufacturer","description":"One of the world''s largest solar energy companies with 60+ GW of modules shipped and 9+ GW of utility projects."}',
    'contact@canadiansolar.com', 'Project Development Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'JinkoSolar',
    '{"city":"Shanghai","state":"Shanghai","country":"China","website":"jinkosolar.com","type":"Manufacturer","description":"World''s leading solar panel manufacturer having shipped 200+ GW of modules to 200+ countries and regions."}',
    'contact@jinkosolar.com', 'Global Sales Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'LONGi Solar',
    '{"city":"Xi''an","state":"Shaanxi","country":"China","website":"longi-solar.com","type":"Manufacturer","description":"World''s largest solar technology company specializing in monocrystalline silicon wafers and high-efficiency modules."}',
    'contact@longi-solar.com', 'Global Business Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Trina Solar',
    '{"city":"Changzhou","state":"Jiangsu","country":"China","website":"trinasolar.com","type":"Manufacturer","description":"Leading global solar company with 100+ GW of modules shipped and a growing utility-scale project development division."}',
    'contact@trinasolar.com', 'International Project Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'JA Solar',
    '{"city":"Beijing","state":"Beijing","country":"China","website":"jasolar.com","type":"Manufacturer","description":"One of the world''s largest solar cell and module manufacturers with 80+ GW of module shipments globally."}',
    'contact@jasolar.com', 'Global Account Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Hanwha Q CELLS',
    '{"city":"Seoul","state":"Seoul","country":"South Korea","website":"q-cells.com","type":"Manufacturer","description":"Global solar manufacturer and project developer with premium Q.ANTUM technology and 3+ GW of US projects."}',
    'contact@q-cells.com', 'Americas Development Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Maxeon Solar Technologies',
    '{"city":"Singapore","state":"Singapore","country":"Singapore","website":"maxeon.com","type":"Manufacturer","description":"Premium solar panel manufacturer spun off from SunPower, known for world-record high-efficiency IBC solar cells."}',
    'contact@maxeon.com', 'Technical Operations Director', 'coatzadrone', 'IN_PROGRESS', 1),

  -- ── Canadian & Latin American Players ────────────────────────────────────
  (solar_industry_id, 'Brookfield Renewable Partners',
    '{"city":"Toronto","state":"Ontario","country":"Canada","website":"brookfieldrenewable.com","type":"Utility-Scale Owner","description":"One of the world''s largest pure-play renewable energy platforms with 30+ GW of solar and hydro globally."}',
    'contact@brookfieldrenewable.com', 'Portfolio Asset Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Atlas Renewable Energy',
    '{"city":"Miami","state":"FL","country":"United States","website":"atlasrenewableenergy.com","type":"Developer-EPC","description":"Latin America''s leading renewable energy developer with 4+ GW of solar in operation across Chile, Brazil, Mexico and Colombia."}',
    'contact@atlasrenewableenergy.com', 'Operations Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Sonnedix',
    '{"city":"London","state":"England","country":"United Kingdom","website":"sonnedix.com","type":"Utility-Scale Owner","description":"International solar IPP owning and operating 3+ GW of solar across Europe, Americas, Japan and South Africa."}',
    'contact@sonnedix.com', 'Asset Management Director', 'coatzadrone', 'IN_PROGRESS', 1),

  -- ── O&M Specialists ───────────────────────────────────────────────────────
  (solar_industry_id, 'Terrasmart',
    '{"city":"Fort Myers","state":"FL","country":"United States","website":"terrasmart.com","type":"O&M","description":"Leading US solar O&M provider and racking manufacturer managing 4+ GW of solar assets with integrated inspection services."}',
    'contact@terrasmart.com', 'O&M Operations Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'IEA Energy Services',
    '{"city":"Minneapolis","state":"MN","country":"United States","website":"iea.us","type":"O&M","description":"Leading US renewable energy EPC contractor providing construction, O&M and asset management for 50+ GW of projects."}',
    'contact@iea.us', 'VP Field Services', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Siemens Gamesa Renewable Energy',
    '{"city":"Zamudio","state":"Basque Country","country":"Spain","website":"siemensgamesa.com","type":"O&M","description":"Global renewable energy technology leader providing turbines, solar O&M and lifecycle services for 100+ GW of projects."}',
    'contact@siemensgamesa.com', 'Solar Services Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Borrego',
    '{"city":"San Diego","state":"CA","country":"United States","website":"borrego.com","type":"O&M","description":"Vertically integrated US solar company delivering 3+ GW of commercial and community solar projects with dedicated O&M."}',
    'contact@borrego.com', 'Director of Asset Services', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Coronal Energy',
    '{"city":"Bethesda","state":"MD","country":"United States","website":"coronalenergy.com","type":"O&M","description":"Pacifico Energy subsidiary providing solar project development, EPC and long-term O&M services in the US market."}',
    'contact@coronalenergy.com', 'Asset Management Lead', 'coatzadrone', 'IN_PROGRESS', 1),

  -- ── High-Value Additional Players (from industry research) ───────────────
  (solar_industry_id, 'NovaSource Power Services',
    '{"city":"Chandler","state":"AZ","country":"United States","website":"novasourcepower.com","type":"O&M","description":"World''s largest independent solar O&M provider, managing 50+ GW of utility-scale and distributed solar globally — top target for drone inspection."}',
    'contact@novasourcepower.com', 'VP Field Operations', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'SOLV Energy',
    '{"city":"San Diego","state":"CA","country":"United States","website":"solvenergy.com","type":"Developer-EPC","description":"Leading US utility-scale solar EPC contractor and O&M provider engineering and constructing GW-scale solar and storage plants nationwide."}',
    'contact@solvenergy.com', 'Director of Asset Services', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Arevon Energy',
    '{"city":"Scottsdale","state":"AZ","country":"United States","website":"arevonenergy.com","type":"Utility-Scale Owner","description":"Independent power producer and asset manager owning and operating utility-scale solar and storage facilities across the US Southwest and Southeast."}',
    'contact@arevonenergy.com', 'Asset Management Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'EDF Renewables',
    '{"city":"San Diego","state":"CA","country":"United States","website":"edf-renewables.com","type":"Utility-Scale Owner","description":"US subsidiary of French utility EDF, owning and operating multi-GW of solar and solar-plus-storage assets across North America."}',
    'contact@edf-renewables.com', 'Asset Management Lead', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Silicon Ranch',
    '{"city":"Nashville","state":"TN","country":"United States","website":"siliconranch.com","type":"Developer-EPC","description":"Leading US utility-scale solar developer, owner and operator backed by Shell, building and managing large solar farms in the Southeast US."}',
    'contact@siliconranch.com', 'Operations Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Strata Clean Energy',
    '{"city":"Durham","state":"NC","country":"United States","website":"stratacleanenergy.com","type":"Developer-EPC","description":"Vertically integrated solar company developing, constructing, owning and operating utility-scale solar and storage primarily in the Southeastern US."}',
    'contact@stratacleanenergy.com', 'VP Asset Management', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Recurrent Energy',
    '{"city":"Austin","state":"TX","country":"United States","website":"recurrentenergy.com","type":"Developer-EPC","description":"Wholly owned subsidiary of Canadian Solar developing and managing utility-scale solar and storage projects globally with 30+ GW pipeline."}',
    'contact@recurrentenergy.com', 'Project Development Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Pattern Energy',
    '{"city":"San Francisco","state":"CA","country":"United States","website":"patternenergy.com","type":"Utility-Scale Owner","description":"Privately owned developer, owner and operator of utility-scale solar, wind and storage projects across North America."}',
    'contact@patternenergy.com', 'Asset Operations Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'ENGIE North America',
    '{"city":"Houston","state":"TX","country":"United States","website":"engie.com","type":"O&M","description":"North American arm of French utility ENGIE, developing, owning and operating a significant portfolio of utility-scale solar, wind and storage projects."}',
    'contact@engie-northamerica.com', 'Solar O&M Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Quanta Services',
    '{"city":"Houston","state":"TX","country":"United States","website":"quantaservices.com","type":"Developer-EPC","description":"Publicly traded infrastructure services company with one of the largest solar EPC market shares in the US via its renewable energy divisions."}',
    'contact@quantaservices.com', 'Renewable Energy Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Mortenson',
    '{"city":"Minneapolis","state":"MN","country":"United States","website":"mortenson.com","type":"Developer-EPC","description":"Major US construction company and leading solar EPC firm, building GW-scale utility solar and storage projects across the country."}',
    'contact@mortenson.com', 'Solar EPC Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Nexamp',
    '{"city":"Boston","state":"MA","country":"United States","website":"nexamp.com","type":"Commercial","description":"Leading community and commercial solar developer and owner providing shared solar subscriptions to businesses and residents across the northeastern US."}',
    'contact@nexamp.com', 'Operations Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Savion',
    '{"city":"Kansas City","state":"MO","country":"United States","website":"savionenergy.com","type":"Developer-EPC","description":"Shell-owned utility-scale solar and storage developer building a large project pipeline across the US with focus on the Midwest and Southeast."}',
    'contact@savionenergy.com', 'Development Director', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Equinor Renewables',
    '{"city":"Stavanger","state":"Rogaland","country":"Norway","website":"equinor.com","type":"Utility-Scale Owner","description":"Norwegian state-majority energy company building a utility-scale solar portfolio in the US, Brazil, Poland and Denmark as part of its energy transition strategy."}',
    'contact@equinor.com', 'Solar Asset Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'Greenskies Clean Focus',
    '{"city":"Middletown","state":"CT","country":"United States","website":"greenskies.com","type":"Commercial","description":"Develops, finances, builds, owns and operates commercial and industrial rooftop and ground-mount solar projects for businesses and municipalities nationwide."}',
    'contact@greenskies.com', 'O&M Manager', 'coatzadrone', 'IN_PROGRESS', 1),

  (solar_industry_id, 'SunEnergy1',
    '{"city":"Charlotte","state":"NC","country":"United States","website":"sunenergy1.com","type":"Developer-EPC","description":"Large-scale solar EPC and development company specializing in utility and commercial solar installations across the Southeastern and Mid-Atlantic US."}',
    'contact@sunenergy1.com', 'Operations Director', 'coatzadrone', 'IN_PROGRESS', 1)

  ON CONFLICT DO NOTHING;

END $$;
