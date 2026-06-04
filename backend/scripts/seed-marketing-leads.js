/**
 * Seed script for Marketing Hub leads
 * Run: node backend/scripts/seed-marketing-leads.js
 * Inserts 76 real companies across solar, insurance, construction, telecom
 */
import db from '../config/database.js';

const LEADS = [
  // ── SOLAR (20) ──
  { company_name: "NextEra Energy", industry: "solar", sub_category: "Utility-scale solar operator", location: "Juno Beach", state: "FL", contact_email: "partnerships@nexteraenergy.com", notes: "World's largest generator of renewable energy from wind and solar" },
  { company_name: "First Solar", industry: "solar", sub_category: "Solar panel manufacturer", location: "Tempe", state: "AZ", contact_email: "info@firstsolar.com", notes: "Leading American manufacturer of thin-film PV solar panels" },
  { company_name: "Cypress Creek Renewables", industry: "solar", sub_category: "Solar developer/operator", location: "Santa Monica", state: "CA", contact_email: "info@cypresscreekenergy.com", notes: "Develops, finances, owns and operates utility-scale solar projects" },
  { company_name: "Recurrent Energy", industry: "solar", sub_category: "Solar project developer", location: "Austin", state: "TX", contact_email: "info@recurrentenergy.com", notes: "Subsidiary of Canadian Solar; major utility-scale solar developer" },
  { company_name: "Invenergy", industry: "solar", sub_category: "Renewable energy developer", location: "Chicago", state: "IL", contact_email: "info@invenergy.com", notes: "Leading developer of large-scale renewable energy projects" },
  { company_name: "Avantus (8minute Solar)", industry: "solar", sub_category: "Solar/storage developer", location: "San Diego", state: "CA", contact_email: "info@avantus.com", notes: "One of the largest independent solar and storage developers in the U.S." },
  { company_name: "SOLV Energy", industry: "solar", sub_category: "Solar EPC contractor", location: "San Diego", state: "CA", contact_email: "info@solvenergy.com", notes: "Leading utility-scale solar EPC contractor in the U.S." },
  { company_name: "Lightsource bp", industry: "solar", sub_category: "Solar energy company", location: "San Francisco", state: "CA", contact_email: "info@lightsourcebp.com", notes: "Global solar energy company (JV with bp)" },
  { company_name: "AES Clean Energy", industry: "solar", sub_category: "Renewable energy operator", location: "Arlington", state: "VA", contact_email: "info@aes.com", notes: "Develops and operates utility-scale solar, wind, and storage" },
  { company_name: "Arevon Energy", industry: "solar", sub_category: "Renewable asset owner", location: "Scottsdale", state: "AZ", contact_email: "info@arevonenergy.com", notes: "Develops, owns, and operates solar and energy storage assets" },
  { company_name: "Strata Clean Energy", industry: "solar", sub_category: "Solar EPC/O&M provider", location: "Durham", state: "NC", contact_email: "info@stratacleanenergy.com", notes: "Full-service solar and storage developer and EPC contractor" },
  { company_name: "Silicon Ranch", industry: "solar", sub_category: "Solar platform operator", location: "Nashville", state: "TN", contact_email: "info@siliconranch.com", notes: "Integrated solar platform across Southeast and Midwest U.S." },
  { company_name: "EDF Renewables North America", industry: "solar", sub_category: "Renewable energy developer", location: "San Diego", state: "CA", contact_email: "info@edf-re.com", notes: "U.S. subsidiary of EDF Group; solar, wind, and geothermal" },
  { company_name: "Clearway Energy", industry: "solar", sub_category: "Clean energy owner", location: "San Francisco", state: "CA", contact_email: "info@clearwayenergy.com", notes: "One of the largest clean energy owners in the U.S." },
  { company_name: "Avangrid Renewables", industry: "solar", sub_category: "Renewable energy operator", location: "Portland", state: "OR", contact_email: "info@avangrid.com", notes: "Wind and solar assets across 22 U.S. states" },
  { company_name: "Longroad Energy", industry: "solar", sub_category: "Renewable developer", location: "Boston", state: "MA", contact_email: "info@longroadenergy.com", notes: "Independent renewable energy developer and owner-operator" },
  { company_name: "Pine Gate Renewables", industry: "solar", sub_category: "Solar project developer", location: "Asheville", state: "NC", contact_email: "info@pinegaterenewables.com", notes: "Developer and owner of utility-scale solar projects in Eastern U.S." },
  { company_name: "Savion Energy", industry: "solar", sub_category: "Solar/storage developer", location: "Kansas City", state: "MO", contact_email: "info@savionenergy.com", notes: "Utility-scale solar and energy storage developer" },
  { company_name: "BrightNight Power", industry: "solar", sub_category: "IPP - renewables", location: "West Palm Beach", state: "FL", contact_email: "info@brightnightpower.com", notes: "Independent power producer focused on hybrid renewable energy" },
  { company_name: "Enel Green Power NA", industry: "solar", sub_category: "Renewable energy operator", location: "Andover", state: "MA", contact_email: "info@enel.com", notes: "U.S. division of global energy company Enel" },

  // ── INSURANCE (19) ──
  { company_name: "State Farm", industry: "insurance", sub_category: "P&C insurer", location: "Bloomington", state: "IL", contact_email: "partnerships@statefarm.com", notes: "Largest P&C insurer in the U.S.; uses drone imagery for claims" },
  { company_name: "Allstate Insurance", industry: "insurance", sub_category: "P&C insurer", location: "Northbrook", state: "IL", contact_email: "partnerships@allstate.com", notes: "Active user of aerial/drone technology for claims adjusting" },
  { company_name: "USAA", industry: "insurance", sub_category: "Financial services/insurance", location: "San Antonio", state: "TX", contact_email: "partnerships@usaa.com", notes: "Serves military members; advanced claims technology" },
  { company_name: "Travelers Insurance", industry: "insurance", sub_category: "P&C insurer", location: "New York", state: "NY", contact_email: "partnerships@travelers.com", notes: "Early adopter of drone technology for property inspections" },
  { company_name: "Liberty Mutual", industry: "insurance", sub_category: "P&C insurer", location: "Boston", state: "MA", contact_email: "partnerships@libertymutual.com", notes: "Uses drones for commercial property and roof assessments" },
  { company_name: "Progressive Insurance", industry: "insurance", sub_category: "P&C insurer", location: "Mayfield Village", state: "OH", contact_email: "partnerships@progressive.com", notes: "Tech-forward claims processing including aerial imagery" },
  { company_name: "Nationwide Insurance", industry: "insurance", sub_category: "Mutual insurer", location: "Columbus", state: "OH", contact_email: "partnerships@nationwide.com", notes: "Personal and commercial lines, farm and agribusiness coverage" },
  { company_name: "Erie Insurance", industry: "insurance", sub_category: "Regional P&C insurer", location: "Erie", state: "PA", contact_email: "info@erieinsurance.com", notes: "Regional P&C insurer operating in 12 states" },
  { company_name: "Farmers Insurance", industry: "insurance", sub_category: "P&C insurer", location: "Woodland Hills", state: "CA", contact_email: "partnerships@farmersinsurance.com", notes: "Top-10 U.S. P&C insurer with exclusive agent network" },
  { company_name: "The Hartford", industry: "insurance", sub_category: "P&C / group benefits", location: "Hartford", state: "CT", contact_email: "info@thehartford.com", notes: "Major P&C and group benefits insurer" },
  { company_name: "Chubb Limited", industry: "insurance", sub_category: "Global P&C insurer", location: "Warren", state: "NJ", contact_email: "info@chubb.com", notes: "World's largest publicly traded P&C insurer" },
  { company_name: "Auto-Owners Insurance", industry: "insurance", sub_category: "Mutual P&C insurer", location: "Lansing", state: "MI", contact_email: "info@aoins.com", notes: "Super-regional mutual insurer in 26 states" },
  { company_name: "Hanover Insurance Group", industry: "insurance", sub_category: "P&C holding company", location: "Worcester", state: "MA", contact_email: "info@hanover.com", notes: "Serves through independent agents" },
  { company_name: "Cincinnati Financial", industry: "insurance", sub_category: "P&C / life insurer", location: "Fairfield", state: "OH", contact_email: "info@cinfin.com", notes: "Focused on commercial lines through independent agents" },
  { company_name: "Amica Mutual Insurance", industry: "insurance", sub_category: "Direct-writing insurer", location: "Lincoln", state: "RI", contact_email: "info@amica.com", notes: "Highly rated for customer satisfaction" },
  { company_name: "Westfield Insurance", industry: "insurance", sub_category: "Regional P&C insurer", location: "Westfield Center", state: "OH", contact_email: "info@westfieldgrp.com", notes: "Regional insurer across Midwest and Eastern U.S." },
  { company_name: "CSAA Insurance Group", industry: "insurance", sub_category: "AAA insurer", location: "Walnut Creek", state: "CA", contact_email: "info@csaa.com", notes: "AAA insurer providing coverage to members in 23 states" },
  { company_name: "Zurich North America", industry: "insurance", sub_category: "Commercial insurer", location: "Schaumburg", state: "IL", contact_email: "info@zurichna.com", notes: "Specializes in commercial property, casualty, and risk engineering" },
  { company_name: "Secura Insurance", industry: "insurance", sub_category: "Mutual P&C insurer", location: "Neenah", state: "WI", contact_email: "info@secura.net", notes: "Mutual P&C insurance in the Upper Midwest" },

  // ── CONSTRUCTION (20) ──
  { company_name: "Turner Construction", industry: "construction", sub_category: "General contractor", location: "New York", state: "NY", contact_email: "info@tcco.com", notes: "#1 ranked U.S. general contractor; commercial and institutional" },
  { company_name: "Kiewit Corporation", industry: "construction", sub_category: "Infrastructure/engineering", location: "Omaha", state: "NE", contact_email: "info@kiewit.com", notes: "One of the largest construction and engineering companies in NA" },
  { company_name: "Bechtel", industry: "construction", sub_category: "Infrastructure/energy", location: "Reston", state: "VA", contact_email: "info@bechtel.com", notes: "Global leader in large-scale infrastructure and energy construction" },
  { company_name: "Fluor Corporation", industry: "construction", sub_category: "Engineering/construction", location: "Irving", state: "TX", contact_email: "info@fluor.com", notes: "Multinational engineering firm; energy, chemicals, infrastructure" },
  { company_name: "AECOM", industry: "construction", sub_category: "Infrastructure consulting", location: "Dallas", state: "TX", contact_email: "info@aecom.com", notes: "Global infrastructure consulting and construction management" },
  { company_name: "Jacobs Engineering", industry: "construction", sub_category: "Professional services", location: "Dallas", state: "TX", contact_email: "info@jacobs.com", notes: "Engineering, consulting, and technical services" },
  { company_name: "Skanska USA", industry: "construction", sub_category: "General contractor", location: "New York", state: "NY", contact_email: "info@skanska.com", notes: "Commercial building, heavy civil, and infrastructure" },
  { company_name: "MasTec Inc.", industry: "construction", sub_category: "Specialty contractor", location: "Coral Gables", state: "FL", contact_email: "info@mastec.com", notes: "Energy, telecom, and pipeline infrastructure construction" },
  { company_name: "Whiting-Turner Contracting", industry: "construction", sub_category: "General contractor", location: "Baltimore", state: "MD", contact_email: "info@whiting-turner.com", notes: "One of the largest U.S. general contractors" },
  { company_name: "DPR Construction", industry: "construction", sub_category: "Technical builder", location: "Redwood City", state: "CA", contact_email: "info@dpr.com", notes: "Healthcare, higher ed, advanced technology construction" },
  { company_name: "Granite Construction", industry: "construction", sub_category: "Heavy civil contractor", location: "Watsonville", state: "CA", contact_email: "info@gcinc.com", notes: "Transportation, water, and infrastructure projects" },
  { company_name: "Hensel Phelps", industry: "construction", sub_category: "General contractor", location: "Greeley", state: "CO", contact_email: "info@henselphelps.com", notes: "Employee-owned; commercial, government, institutional" },
  { company_name: "McCarthy Building Companies", industry: "construction", sub_category: "General contractor", location: "St. Louis", state: "MO", contact_email: "info@mccarthy.com", notes: "One of the oldest privately held construction firms" },
  { company_name: "Clark Construction Group", industry: "construction", sub_category: "General contractor", location: "Bethesda", state: "MD", contact_email: "info@clarkconstruction.com", notes: "Complex commercial, healthcare, and government projects" },
  { company_name: "The Walsh Group", industry: "construction", sub_category: "Civil/building contractor", location: "Chicago", state: "IL", contact_email: "info@walshgroup.com", notes: "Transportation, heavy civil, water, and building construction" },
  { company_name: "Mortenson Construction", industry: "construction", sub_category: "General contractor", location: "Minneapolis", state: "MN", contact_email: "info@mortenson.com", notes: "Employee-owned; renewable energy and commercial construction" },
  { company_name: "Brasfield & Gorrie", industry: "construction", sub_category: "General contractor", location: "Birmingham", state: "AL", contact_email: "info@brasfieldgorrie.com", notes: "One of the largest privately held construction firms" },
  { company_name: "Holder Construction", industry: "construction", sub_category: "General contractor", location: "Atlanta", state: "GA", contact_email: "info@holderconstruction.com", notes: "Mission-critical and advanced technology construction" },
  { company_name: "Sundt Construction", industry: "construction", sub_category: "General contractor", location: "Tempe", state: "AZ", contact_email: "info@sundt.com", notes: "Employee-owned; transportation and industrial in Southwest" },
  { company_name: "Barton Malow", industry: "construction", sub_category: "Construction services", location: "Southfield", state: "MI", contact_email: "info@bartonmalow.com", notes: "Commercial, industrial, and infrastructure projects" },

  // ── TELECOM (17) ──
  { company_name: "American Tower Corporation", industry: "telecom", sub_category: "Cell tower operator", location: "Boston", state: "MA", contact_email: "info@americantower.com", notes: "Largest cell tower operator in the U.S. and globally" },
  { company_name: "Crown Castle International", industry: "telecom", sub_category: "Tower/fiber infrastructure", location: "Houston", state: "TX", contact_email: "info@crowncastle.com", notes: "40,000+ towers and 85,000+ route miles of fiber" },
  { company_name: "SBA Communications", industry: "telecom", sub_category: "Tower REIT", location: "Boca Raton", state: "FL", contact_email: "info@sbasite.com", notes: "Owns and operates wireless infrastructure across Americas" },
  { company_name: "Vertical Bridge", industry: "telecom", sub_category: "Tower owner/operator", location: "Delray Beach", state: "FL", contact_email: "info@verticalbridge.com", notes: "Largest private tower owner/operator in the U.S." },
  { company_name: "T-Mobile US", industry: "telecom", sub_category: "Wireless carrier", location: "Bellevue", state: "WA", contact_email: "partnerships@t-mobile.com", notes: "Major U.S. wireless carrier; 5G network infrastructure" },
  { company_name: "AT&T", industry: "telecom", sub_category: "Telecom carrier", location: "Dallas", state: "TX", contact_email: "partnerships@att.com", notes: "Largest U.S. telecom company; extensive network infrastructure" },
  { company_name: "Verizon Communications", industry: "telecom", sub_category: "Telecom carrier", location: "New York", state: "NY", contact_email: "partnerships@verizon.com", notes: "Major U.S. telecom carrier; thousands of cell sites" },
  { company_name: "Tillman Infrastructure", industry: "telecom", sub_category: "Tower developer", location: "New York", state: "NY", contact_email: "info@tillmaninfrastructure.com", notes: "Build-to-suit cell tower developer" },
  { company_name: "Diamond Communications", industry: "telecom", sub_category: "Tower developer/operator", location: "Springfield", state: "NJ", contact_email: "info@diamondcommunications.com", notes: "Independent cell tower developer and operator" },
  { company_name: "Harmoni Towers", industry: "telecom", sub_category: "Tower company", location: "Charlotte", state: "NC", contact_email: "info@harmonitowers.com", notes: "Mid-size independent tower company" },
  { company_name: "TowerCo", industry: "telecom", sub_category: "Tower infrastructure", location: "Cary", state: "NC", contact_email: "info@towerco.com", notes: "Independent wireless infrastructure company" },
  { company_name: "Everest Infrastructure Partners", industry: "telecom", sub_category: "Tower company", location: "Pittsburgh", state: "PA", contact_email: "info@everestinfrastructure.com", notes: "Acquires, develops, and manages wireless towers" },
  { company_name: "Phoenix Tower International", industry: "telecom", sub_category: "Global tower company", location: "Boca Raton", state: "FL", contact_email: "info@phoenixintnl.com", notes: "Developing and operating wireless infrastructure across Americas" },
  { company_name: "Lumen Technologies", industry: "telecom", sub_category: "Enterprise telecom", location: "Monroe", state: "LA", contact_email: "info@lumen.com", notes: "Formerly CenturyLink; enterprise fiber and communications" },
  { company_name: "Uniti Group", industry: "telecom", sub_category: "Fiber REIT", location: "Little Rock", state: "AR", contact_email: "info@uniti.com", notes: "Fiber optic and telecom infrastructure REIT" },
  { company_name: "MasTec Network Solutions", industry: "telecom", sub_category: "Telecom services", location: "Coral Gables", state: "FL", contact_email: "info@mastec.com", notes: "Tower construction, modification, and maintenance" },
  { company_name: "Dish Network (EchoStar)", industry: "telecom", sub_category: "5G network builder", location: "Englewood", state: "CO", contact_email: "partnerships@dish.com", notes: "Building new nationwide 5G wireless network" },
];

async function seedLeads() {
  console.log('[Seed] Starting marketing leads seed...');
  console.log(`[Seed] Inserting ${LEADS.length} leads...`);

  let inserted = 0;
  let skipped = 0;

  for (const lead of LEADS) {
    try {
      // Check if company already exists
      const existing = await db.query(
        'SELECT id FROM marketing_leads WHERE company_name = $1 LIMIT 1',
        [lead.company_name]
      );
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await db.query(
        `INSERT INTO marketing_leads (company_name, industry, sub_category, location, state, contact_email, notes, status, lead_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', 'prospect')`,
        [lead.company_name, lead.industry, lead.sub_category, lead.location, lead.state, lead.contact_email, lead.notes]
      );
      inserted++;
    } catch (err) {
      console.error(`[Seed] Error inserting ${lead.company_name}:`, err.message);
    }
  }

  console.log(`[Seed] ✅ Done! Inserted: ${inserted}, Skipped (already exist): ${skipped}`);
  process.exit(0);
}

seedLeads().catch(err => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
