/**
 * seed_protocols.js — Industry-standard FAA Part 107 drone inspection protocols
 * Solar, Insurance, Utilities, Telecom, Construction
 * Run: node backend/scripts/seed_protocols.js
 */
import { query } from '../config/database.js';

const protocols = [

  // ═══════════════════════════════════════════════════════════════════
  // PRE-FLIGHT — Universal (all mission types)
  // ═══════════════════════════════════════════════════════════════════
  {
    title: 'Pre-Flight Safety Checklist',
    description: 'FAA Part 107-compliant pre-flight inspection for all drone operations. Must be completed before any flight activity.',
    category: 'pre_flight',
    mission_type: 'all',
    is_required: true,
    version: '2.1',
    steps: [
      { id: 'pf_01', order: 1, title: 'Airspace Authorization', description: 'Verify LAANC authorization or Part 107 waiver is active for this location. Check AirMap, Aloft, or FAA DroneZone for NOTAMs and TFRs.', type: 'check', required: true },
      { id: 'pf_02', order: 2, title: 'Weather Assessment', description: 'Check winds below 25 mph, visibility > 3 statute miles, no precipitation, cloud ceiling > 500 ft above max flight altitude. Document conditions.', type: 'check', required: true },
      { id: 'pf_03', order: 3, title: 'Site Survey & Hazard ID', description: 'Walk the launch/landing zone. Identify overhead wires, trees, structures, people, animals, and RF interference sources within 400 ft.', type: 'check', required: true },
      { id: 'pf_04', order: 4, title: 'Aircraft Physical Inspection', description: 'Inspect all propellers for cracks, chips, or deformation. Check motor mounts, landing gear, and fuselage for damage. Verify all screws are tight.', type: 'check', required: true },
      { id: 'pf_05', order: 5, title: 'Battery Status', description: 'Confirm flight batteries are charged ≥ 90%. Check for swelling, damage, or abnormal heat. Verify battery firmware is current.', type: 'check', required: true },
      { id: 'pf_06', order: 6, title: 'Payload & Sensor Check', description: 'Confirm camera/sensor is mounted securely. Check lens for obstructions. Verify gimbal moves freely across full range. Test video feed.', type: 'check', required: true },
      { id: 'pf_07', order: 7, title: 'Remote Controller Check', description: 'RC battery > 80%. Signal linked. Control surfaces responding correctly. Return-to-Home altitude set (minimum 100 ft above tallest obstacle).', type: 'check', required: true },
      { id: 'pf_08', order: 8, title: 'Storage Media', description: 'Confirm SD/SSD card is inserted, formatted, and has sufficient capacity for the mission. Verify no previous mission data unless intentional.', type: 'check', required: true },
      { id: 'pf_09', order: 9, title: 'GPS & Compass Calibration', description: 'Verify GPS lock ≥ 10 satellites. Check for compass interference warnings. Calibrate if relocating by > 50 miles from last calibration.', type: 'check', required: true },
      { id: 'pf_10', order: 10, title: 'Mission Parameters Review', description: 'Review and confirm flight altitude, speed, overlap settings, and KML/mission plan loaded into GCS app. Verify geofence boundaries.', type: 'check', required: true },
      { id: 'pf_11', order: 11, title: 'Emergency Procedure Brief', description: 'Identify nearest hospital/emergency services. Confirm abort plan, emergency landing zones, and lost-link procedures with any crew members.', type: 'check', required: true },
      { id: 'pf_12', order: 12, title: 'Pilot Certification', description: 'Confirm current FAA Remote Pilot Certificate is in possession. Verify medical self-certification (not impaired by fatigue, medication, or illness).', type: 'sign', required: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // MISSION — Solar Inspection
  // ═══════════════════════════════════════════════════════════════════
  {
    title: 'Solar Farm Inspection Protocol',
    description: 'Standard operating procedure for thermal and RGB drone inspection of utility-scale solar installations. Aligned with IEC 62446-3 and ASTM E1934 standards.',
    category: 'mission',
    mission_type: 'solar',
    is_required: false,
    version: '3.0',
    steps: [
      { id: 's_01', order: 1, title: 'Irradiance Verification', description: 'Confirm solar irradiance ≥ 600 W/m² for thermal anomaly detection. Below this threshold thermal contrast is insufficient for reliable fault mapping. Document GHI reading at mission start.', type: 'input', required: true },
      { id: 's_02', order: 2, title: 'Thermal Camera Warm-Up', description: 'Allow thermal sensor to reach operating temperature for minimum 10 minutes before data collection begins (FLIR-type sensors require stabilization).', type: 'check', required: true },
      { id: 's_03', order: 3, title: 'Reference Panel Baseline', description: 'Capture thermal baseline of known-good reference panel before scan. Record temperature reading for calibration comparison during analysis.', type: 'input', required: false },
      { id: 's_04', order: 4, title: 'Flight Grid Confirmation', description: 'Verify flight grid covers 100% of panel array with ≥ 20% frontal overlap and ≥ 60% side overlap. Altitude set for ≥ 5 cm/pixel GSD on thermal.', type: 'check', required: true },
      { id: 's_05', order: 5, title: 'Row & Block Marking', description: 'Confirm row/block numbering matches site layout diagram provided by client. Document any discrepancies for the final report.', type: 'check', required: true },
      { id: 's_06', order: 6, title: 'Wind & Shade Check', description: 'Pause or abort if wind > 15 mph at flight altitude (creates panel vibration artifacts). Avoid imaging panels in shadow — reschedule those sections.', type: 'check', required: true },
      { id: 's_07', order: 7, title: 'Anomaly Tagging Protocol', description: 'During live review, tag any thermal anomaly with GPS coordinates in GCS. Categories: Cell fault, String fault, Module bypass, Soiling, Delamination, Hot spot.', type: 'check', required: false },
      { id: 's_08', order: 8, title: 'RGB Orthomosaic Pass', description: 'After thermal, fly a secondary RGB pass for physical damage documentation (cracked glass, bird droppings, delamination, shade objects).', type: 'check', required: false },
      { id: 's_09', order: 9, title: 'Data Integrity Check', description: 'Before leaving site, review captured files — verify no missing rows, confirm frame count matches expected coverage, spot-check GPS embedding.', type: 'check', required: true },
      { id: 's_10', order: 10, title: 'Site Access & Safety Compliance', description: 'Confirm coordination with site energy manager. Maintain safe distance from inverters (10 ft minimum) and substations. Follow site-specific arc flash protocols.', type: 'sign', required: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // MISSION — Insurance/Building Inspection
  // ═══════════════════════════════════════════════════════════════════
  {
    title: 'Insurance Property Inspection Protocol',
    description: 'Rooftop and property inspection procedure for P&C insurance underwriting and claims. Aligned with carrier SLAs and NAIC guidelines.',
    category: 'mission',
    mission_type: 'insurance',
    is_required: false,
    version: '2.2',
    steps: [
      { id: 'i_01', order: 1, title: 'Client Authorization', description: 'Confirm written authorization from property owner or insurer. Verify inspection address matches claim/policy number. Do not fly adjacent properties without separate authorization.', type: 'sign', required: true },
      { id: 'i_02', order: 2, title: 'Property Survey', description: 'Identify all structures on parcel: main structure, detached garage, outbuildings, pools, fencing. Capture establishing shot showing full property boundary.', type: 'check', required: true },
      { id: 'i_03', order: 3, title: 'Roof Condition Documentation', description: 'Capture all four roof facets at 45° and nadir angles. Document: ridge, valleys, flashings, penetrations, gutters, downspouts, chimney, skylights, HVAC equipment.', type: 'check', required: true },
      { id: 'i_04', order: 4, title: 'Damage Category Assessment', description: 'Identify and photograph any visible damage: hail impact marks, wind-lifted shingles, missing materials, debris impact, ice damming, moss/algae growth, structural sagging.', type: 'input', required: true },
      { id: 'i_05', order: 5, title: 'Measurement Documentation', description: 'Capture reference objects for scale (HVAC units, standard shingles). Flag slope areas requiring pitch measurement. Ensure sufficient data for Hover/EagleView comparison.', type: 'check', required: false },
      { id: 'i_06', order: 6, title: 'Elevation & Exterior', description: 'Document all four building elevations, siding condition, window integrity, foundation visible areas, and any fire or water intrusion evidence.', type: 'check', required: true },
      { id: 'i_07', order: 7, title: 'Proximity Rules', description: 'Maintain minimum 25 ft from structures during flight. Do not fly below eave line of neighboring structures. Respect 400 ft altitude ceiling.', type: 'check', required: true },
      { id: 'i_08', order: 8, title: 'Privacy Compliance', description: 'Do not capture interior of any structure through windows. Do not linger over neighboring properties. Disable any live streaming to external services.', type: 'sign', required: true },
      { id: 'i_09', order: 9, title: 'Image Quality Verification', description: 'Confirm minimum resolution of 12MP per image. All images must be GPS-tagged. Verify no motion blur, overexposure, or obstruction. Minimum 50 images for standard residential.', type: 'check', required: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // MISSION — Utilities / Power Grid
  // ═══════════════════════════════════════════════════════════════════
  {
    title: 'Utility Infrastructure Inspection Protocol',
    description: 'Inspection protocol for power transmission lines, distribution networks, substations, and related infrastructure. Aligned with NERC FAC-001 and OSHA 1910.269.',
    category: 'mission',
    mission_type: 'utilities',
    is_required: false,
    version: '2.0',
    steps: [
      { id: 'u_01', order: 1, title: 'Utility Coordination', description: 'Confirm inspection clearance with utility operations center. Get work order number and confirm outage status if applicable. Emergency contact number on file.', type: 'sign', required: true },
      { id: 'u_02', order: 2, title: 'Power Line Clearances', description: 'Confirm minimum safe separation: 50 ft horizontal from energized HV lines, 10 ft from low-voltage distribution. Electric field may interfere with compass — recalibrate after positioning.', type: 'check', required: true },
      { id: 'u_03', order: 3, title: 'EMF Interference Test', description: 'Power on aircraft at inspection start point. Verify no compass or IMU errors. If errors present, move launch point 100+ ft from nearest conductor.', type: 'check', required: true },
      { id: 'u_04', order: 4, title: 'Transmission Structure Inspection', description: 'Inspect: insulator strings, conductor clamps, vibration dampers, tower/pole hardware, ground wire, arc marks, wildlife nesting, vegetation encroachment.', type: 'check', required: true },
      { id: 'u_05', order: 5, title: 'Thermal Scan for Hot Connections', description: 'Use thermal camera to detect overheating: splice joints, dead-end clamps, insulator failures, transformer connections. Flag any ΔT > 15°C above ambient.', type: 'input', required: false },
      { id: 'u_06', order: 6, title: 'LiDAR Vegetation Clearance', description: 'If LiDAR-equipped: verify required clearance between conductors and vegetation per applicable NERC FAC-003 standards. Flag vegetation within encroachment zone.', type: 'check', required: false },
      { id: 'u_07', order: 7, title: 'Emergency Landing Plan', description: 'Identify emergency landing zones that are clear of power lines and structures for each segment. Do not fly directly over energized equipment.', type: 'check', required: true },
      { id: 'u_08', order: 8, title: 'ROW Documentation', description: 'Photograph all signage, access roads, fencing conditions, and right-of-way encroachments along patrol corridor. Note GPS coordinates of access points.', type: 'check', required: false },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // MISSION — Telecom / Tower
  // ═══════════════════════════════════════════════════════════════════
  {
    title: 'Telecommunications Tower Inspection Protocol',
    description: 'Close-proximity drone inspection of cell towers, broadcast antennas, and related telecom infrastructure. Aligned with NATE TCIA and TIA-222 standards.',
    category: 'mission',
    mission_type: 'telecom',
    is_required: false,
    version: '1.8',
    steps: [
      { id: 't_01', order: 1, title: 'RF Emissions Clearance', description: 'Confirm active antenna emissions status with tower manager. If radiating: use RF-shielded aircraft or RF monitoring equipment. Do not fly within 10 ft of active antenna face.', type: 'sign', required: true },
      { id: 't_02', order: 2, title: 'FAA Marking Verification', description: 'Confirm tower height and FAA obstruction lighting per AC 70/7460-1. Structures > 200 AGL require special operations planning or waiver.', type: 'check', required: true },
      { id: 't_03', order: 3, title: 'Tower Structure Inspection', description: 'Inspect: base section, anchor bolts, climbing pegs, guy wire attachments, weathering/corrosion on structural members, welds, and coatings.', type: 'check', required: true },
      { id: 't_04', order: 4, title: 'Antenna & Line System', description: 'Document all antenna mounting brackets, cable management, weatherproofing boots, RET actuators, and line pressurization fittings. Note any cable kinking or UV degradation.', type: 'check', required: true },
      { id: 't_05', order: 5, title: 'Close-Proximity Flight Limits', description: 'Maximum flight speed 2 m/s within 20 ft of structure. Altitude change not to exceed 1 m/s vertical. Manual flight mode required within 10 ft of structure.', type: 'check', required: true },
      { id: 't_06', order: 6, title: 'GPS Denied Operations', description: 'Confirm pilot is qualified for non-GPS visual positioning. Test ATTI/manual mode before approaching tower (GPS shadow expected near structure).', type: 'check', required: true },
      { id: 't_07', order: 7, title: 'Equipment Log', description: 'Record all attached equipment makes/models, their mounting heights, azimuth direction, and visible condition rating (1-5 scale).', type: 'input', required: false },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // MISSION — Construction
  // ═══════════════════════════════════════════════════════════════════
  {
    title: 'Construction Site Progress Inspection Protocol',
    description: 'Site progress monitoring and documentation protocol for active construction projects. Aligned with OSHA 1926 construction safety standards.',
    category: 'mission',
    mission_type: 'construction',
    is_required: false,
    version: '1.5',
    steps: [
      { id: 'c_01', order: 1, title: 'Site Safety Briefing', description: 'Check in with site safety manager. Receive active hazard briefing: crane swing zones, personnel exclusion areas, scheduled concrete pours, delivery windows.', type: 'sign', required: true },
      { id: 'c_02', order: 2, title: 'Hard Hat & Vest', description: 'Pilot and any ground crew must wear hard hat and high-visibility vest at all times on active construction site.', type: 'check', required: true },
      { id: 'c_03', order: 3, title: 'Crane & Heavy Equipment Coordination', description: 'Notify crane operator and all heavy equipment operators before flight. Establish radio channel. Cease flight if crane swings into flight path.', type: 'check', required: true },
      { id: 'c_04', order: 4, title: 'People Clearance Zone', description: 'Establish minimum 25 ft exclusion zone under flight path. Brief all workers. Post spotter on boundaries if area cannot be cleared.', type: 'check', required: true },
      { id: 'c_05', order: 5, title: 'Progress Documentation Coverage', description: 'Capture full site perimeter at nadir and oblique. Photograph: foundation/slab work, structural steel/framing progress, MEP rough-in visible, exterior cladding, site logistics.', type: 'check', required: true },
      { id: 'c_06', order: 6, title: 'GCP / Survey Accuracy', description: 'If photogrammetry deliverable required: verify GCPs are placed and surveyed. Capture each GCP at minimum 5 viewpoints while maintaining safe clearance.', type: 'check', required: false },
      { id: 'c_07', order: 7, title: 'Dust & Debris Risk', description: 'Avoid flying directly over active concrete cutting, grinding, or demolition operations. Dust infiltration can damage sensors and motors.', type: 'check', required: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // POST-FLIGHT — Universal
  // ═══════════════════════════════════════════════════════════════════
  {
    title: 'Post-Flight Wrap & Data Handoff Protocol',
    description: 'Standard post-flight inspection, data verification, and equipment storage procedures. Required after every flight operation.',
    category: 'post_flight',
    mission_type: 'all',
    is_required: true,
    version: '2.0',
    steps: [
      { id: 'post_01', order: 1, title: 'Aircraft Inspection', description: 'Inspect all propellers for damage sustained during flight. Check motor temps (should cool < 45°C within 5 min). Inspect fuselage for new damage. Check landing gear.', type: 'check', required: true },
      { id: 'post_02', order: 2, title: 'Battery Care', description: 'Allow batteries to cool before storage (≥ 15 min post-flight). Discharge to storage level (50-60%) if not flying within 24 hours. Log cycle count.', type: 'check', required: true },
      { id: 'post_03', order: 3, title: 'Data Offload & Verification', description: 'Offload all media to at least 2 separate storage devices (primary + backup). Verify file count matches expected frame count. Confirm GPS data is embedded in EXIF.', type: 'check', required: true },
      { id: 'post_04', order: 4, title: 'Data Quality Review', description: 'Spot-check 10% of captured images/thermal frames for focus, exposure, coverage gaps, and GPS accuracy drift. Flag any anomalies before leaving site.', type: 'check', required: true },
      { id: 'post_05', order: 5, title: 'Flight Log Entry', description: 'Record in flight log: date, location, pilot name, aircraft tail number, battery cycles used, flight durations, max altitude, and any incidents.', type: 'input', required: true },
      { id: 'post_06', order: 6, title: 'Incident / Anomaly Report', description: 'If any near-miss, fly-away, equipment malfunction, or property contact occurred — complete incident report immediately before leaving site.', type: 'check', required: true },
      { id: 'post_07', order: 7, title: 'Equipment Storage', description: 'Clean aircraft and sensors. Store batteries in LiPo-safe bag. Secure all equipment in transport cases. Confirm no equipment left at site.', type: 'check', required: true },
      { id: 'post_08', order: 8, title: 'Client Site Restoration', description: 'Return any moved objects to original position. Ensure gates/access points are secured as found. Report completed to site contact or operations center.', type: 'sign', required: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // EMERGENCY PROCEDURES
  // ═══════════════════════════════════════════════════════════════════
  {
    title: 'Emergency Procedures & Lost Aircraft Protocol',
    description: 'Immediate action procedures for aircraft emergencies, loss of control link, fly-away events, and injury response. Review before every operation.',
    category: 'emergency',
    mission_type: 'all',
    is_required: false,
    version: '1.3',
    steps: [
      { id: 'e_01', order: 1, title: 'Loss of Control Link', description: 'Aircraft should execute RTH automatically. Monitor countdown. If aircraft does not return: note last known GPS coordinates, alert all personnel to clear area, contact ATC if near controlled airspace.', type: 'check', required: true },
      { id: 'e_02', order: 2, title: 'Fly-Away Response', description: 'Immediately alert all ground crew to hazard. Call 911 if aircraft continues beyond visual range. Note last GPS position from GCS. File FAA incident report within 10 days per Part 107.9.', type: 'check', required: true },
      { id: 'e_03', order: 3, title: 'Motor or Propeller Failure', description: 'Attempt controlled descent to safest available area. Cut throttle before impact if over people. Do not reach into spinning motors. Alert personnel to impact zone.', type: 'check', required: true },
      { id: 'e_04', order: 4, title: 'Battery Fire Response', description: 'Do NOT use water on LiPo fire. Use dry sand or ABC extinguisher. Move aircraft away from fuel/combustibles if safe to do so. Call 911. Do not inhale fumes.', type: 'check', required: true },
      { id: 'e_05', order: 5, title: 'Injury Response', description: 'Call 911 immediately for any person injured. Administer first aid if certified. Do not move injured person unless in immediate danger. Preserve scene for investigation.', type: 'check', required: true },
      { id: 'e_06', order: 6, title: 'FAA Incident Reporting', description: 'Reportable events: serious injury, loss of consciousness, property damage > $500. File ASRS report if applicable. Contact company safety officer within 1 hour of incident.', type: 'sign', required: true },
      { id: 'e_07', order: 7, title: 'Emergency Contacts On File', description: 'Confirm you have noted: nearest hospital address, site emergency contact, company operations number, local ATC frequency, and FAA FSDO contact.', type: 'input', required: true },
    ],
  },
];

async function seed() {
  let created = 0, skipped = 0;
  for (const p of protocols) {
    const exists = await query(`SELECT id FROM protocols WHERE title = $1 LIMIT 1`, [p.title]);
    if (exists.rows.length > 0) { skipped++; continue; }
    await query(
      `INSERT INTO protocols (title, description, category, mission_type, steps, version, is_required, is_active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, true)`,
      [p.title, p.description, p.category, p.mission_type, JSON.stringify(p.steps), p.version, p.is_required]
    );
    created++;
    console.log('✅ Created:', p.title);
  }
  console.log(`\nDone. Created: ${created}, Skipped (already exists): ${skipped}`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
