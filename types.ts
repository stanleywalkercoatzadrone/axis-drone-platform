
export enum Industry {
  SOLAR = 'Solar',
  UTILITIES = 'Utilities',
  INSURANCE = 'Insurance',
  TELECOM = 'Telecom',
  CONSTRUCTION = 'Construction'
}

export enum Severity {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum ReportTheme {
  EXECUTIVE = 'Executive',
  TECHNICAL = 'Technical',
  MINIMAL = 'Minimal'
}

export enum UserRole {
  ADMIN = 'admin',
  PILOT_TECHNICIAN = 'pilot_technician',
  // Legacy roles kept for backward compatibility
  FIELD_OPERATOR = 'FIELD_OPERATOR',
  SENIOR_INSPECTOR = 'SENIOR_INSPECTOR',
  AUDITOR = 'AUDITOR',
  OPERATIONS = 'OPERATIONS',
  ANALYST = 'ANALYST',
  USER = 'USER',
  CLIENT_USER = 'client_user'
}

export enum Permission {
  CREATE_REPORT = 'create_report',
  EDIT_REPORT = 'edit_report',
  DELETE_REPORT = 'delete_report',
  RELEASE_REPORT = 'release_report',
  MANAGE_USERS = 'manage_users',
  MANAGE_SETTINGS = 'manage_settings',
  VIEW_MASTER_VAULT = 'view_master_vault'
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

export const ROLE_DEFINITIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.PILOT_TECHNICIAN]: [Permission.CREATE_REPORT, Permission.EDIT_REPORT],
  [UserRole.SENIOR_INSPECTOR]: [Permission.CREATE_REPORT, Permission.EDIT_REPORT, Permission.RELEASE_REPORT],
  [UserRole.FIELD_OPERATOR]: [Permission.CREATE_REPORT, Permission.EDIT_REPORT],
  [UserRole.AUDITOR]: [Permission.VIEW_MASTER_VAULT],
  [UserRole.OPERATIONS]: [Permission.CREATE_REPORT, Permission.EDIT_REPORT, Permission.VIEW_MASTER_VAULT, Permission.MANAGE_USERS],
  [UserRole.ANALYST]: [Permission.VIEW_MASTER_VAULT],
  [UserRole.USER]: [Permission.CREATE_REPORT, Permission.EDIT_REPORT],
  [UserRole.CLIENT_USER]: [Permission.VIEW_MASTER_VAULT] // Simplified permissions for client
};

/* ADMIN_PASSKEY removed for security */

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata?: any;
  details?: string; // keeping for backward compat if needed, or remove
  ipAddress?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  companyName: string;
  title?: string;
  role: string; // Changed from UserRole to string to support runtime normalization
  permissions?: Permission[];
  avatarUrl?: string;
  driveLinked: boolean;
  driveFolder?: string;
  googleEmail?: string;
  googlePicture?: string;
  accessToken?: string;
  createdAt: string;
  lastLogin?: string;
  isDriveBlocked?: boolean;
  effectiveRoles?: string[];
  bindings?: UserBinding[];
}

export interface UserBinding {
  role: string;
  scopeType: 'global' | 'customer' | 'project' | 'mission';
  scopeId: string;
}

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
  colorAccent: string;
}

export const INDUSTRY_TEMPLATES: Record<Industry, IndustryTemplate[]> = {
  [Industry.SOLAR]: [
    { id: 'sol-thermal', name: 'Thermal Efficiency Audit', description: 'UAV-based thermal mapping for cell-level hot spot detection.', sections: ['String Performance', 'Cell Temperature Delta', 'Hot Spot Heatmap'], colorAccent: '#f59e0b' },
    { id: 'sol-visual', name: 'Visual Integrity Inspection', description: 'High-res visual check for fractures, soiling, and hardware rust.', sections: ['Panel Integrity', 'Mounting Stability', 'Inverter Housing'], colorAccent: '#fbbf24' },
    { id: 'sol-shading', name: 'Shading & Obstruction Analysis', description: 'Digital twin analysis of environmental shading factors.', sections: ['Vegetation Obstruction', 'Nearby Infrastructure', 'Horizon Mapping'], colorAccent: '#d97706' },
    { id: 'sol-power', name: 'Power Curve Correlation', description: 'Correlating aerial visual data with SCADA power output drops.', sections: ['Yield Analysis', 'Efficiency Variance', 'String-Level Diagnostics'], colorAccent: '#eab308' }
  ],
  [Industry.UTILITIES]: [
    { id: 'util-infra', name: 'Transmission Infrastructure', description: 'Structural integrity of towers, insulators, and conductors.', sections: ['Insulator Flashover Risk', 'Hardware Corrosion', 'Foundation Status'], colorAccent: '#3b82f6' },
    { id: 'util-encroach', name: 'Vegetation Encroachment Study', description: 'LiDAR/Visual analysis of ROW clearance compliance.', sections: ['Clearance Zones', 'Hazard Tree ID', 'Growth Rate Projection'], colorAccent: '#2563eb' },
    { id: 'util-storm', name: 'Rapid Storm Damage Audit', description: 'Emergency post-event assessment for power restoration.', sections: ['Line Sag Metrics', 'Cross-arm Fractures', 'Priority Repair List'], colorAccent: '#1d4ed8' },
    { id: 'util-sub', name: 'Substation Health Monitoring', description: 'Thermal and visual monitoring of transformers and switchgear.', sections: ['Oil Leak Detection', 'Bushing Integrity', 'Security Perimeter'], colorAccent: '#1e40af' }
  ],
  [Industry.INSURANCE]: [
    { id: 'ins-hail', name: 'Hail Damage Substantiation', description: 'Automated hail strike count and impact density analysis.', sections: ['Strike Density Map', 'Collateral Damage', 'Xactimate Estimate'], colorAccent: '#10b981' },
    { id: 'ins-roof', name: 'Roof Condition & Lifecycle Audit', description: 'Pre-underwriting baseline of commercial roofing assets.', sections: ['Membrane Health', 'Drainage Status', 'Estimated Remaining Life'], colorAccent: '#059669' },
    { id: 'ins-wind', name: 'Wind & Debris Damage Report', description: 'Detailed mapping of missing shingles and structural lift.', sections: ['Shingle Uplift Map', 'Fascia Integrity', 'Repair vs Replacement'], colorAccent: '#047857' },
    { id: 'ins-interior', name: 'Interior/Exterior Correlation', description: 'Linking drone exterior data with 360 interior loss data.', sections: ['Intrusion Points', 'Moisture Migration', 'Structural Settlement'], colorAccent: '#065f46' }
  ],
  [Industry.TELECOM]: [
    { id: 'tel-tower', name: 'Tower Structural & Mount Audit', description: 'Close-out/Maintenance check of antenna and mounts.', sections: ['Mount Integrity', 'Bolted Connections', 'Safety Climb Status'], colorAccent: '#8b5cf6' },
    { id: 'tel-align', name: 'Antenna Alignment Verification', description: 'Visual check of tilt, azimuth, and plumb parameters.', sections: ['Azimuth Verification', 'Cabling Health', 'Shielding Integrity'], colorAccent: '#7c3aed' },
    { id: 'tel-comp', name: 'Site Compound Security', description: 'Ground equipment and perimeter security assessment.', sections: ['Fence Integrity', 'Backup Generator', 'Cabinet Security'], colorAccent: '#6d28d9' },
    { id: 'tel-5g', name: '5G Readiness Survey', description: 'Infrastructure check for new 5G small cell deployment.', sections: ['Available Space', 'Power Capacity', 'Backhaul Proximity'], colorAccent: '#5b21b6' }
  ],
  [Industry.CONSTRUCTION]: [
    { id: 'con-progress', name: 'Site Progress Monitoring', description: 'Temporal tracking of construction milestones.', sections: ['Milestone Checklist', 'Schedule Variance', 'Staging Efficiency'], colorAccent: '#64748b' },
    { id: 'con-safety', name: 'OSHA/HSE Compliance Audit', description: 'Aerial site safety check for PPE and hazard markers.', sections: ['Trench Safety', 'Fall Protection', 'PPE Compliance'], colorAccent: '#475569' },
    { id: 'con-vol', name: 'Stockpile Volume Calculation', description: 'Volumetric analysis of earthworks and materials.', sections: ['Cut/Fill Balance', 'Material Inventory', 'Elevation Contours'], colorAccent: '#334155' },
    { id: 'con-found', name: 'Foundation Quality Control', description: 'Pre-pour and post-pour inspection of structural concrete.', sections: ['Rebar Patterning', 'Anchor Bolt Alignment', 'Cracking Analysis'], colorAccent: '#1e293b' }
  ]
};

export interface CostEstimateItem {
  id: string;
  category: string;
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Annotation {
  id: string;
  label: string;
  description: string;
  severity: Severity;
  confidence?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  path?: { x: number, y: number }[];
  type: 'box' | 'path';
  source: 'ai' | 'manual';
  costEstimates?: CostEstimateItem[];
}

export interface GroundingLink {
  title: string;
  uri: string;
}

export interface SiteContext {
  summary: string;
  nearbyHazards: string[];
  sources: GroundingLink[];
}

export interface InspectionImage {
  id: string;
  url: string;
  base64?: string;
  annotations: Annotation[];
  summary?: string;
}

export interface CorrectiveProtocol {
  issueType: string;
  procedure: string[];
  requiredHardware: string[];
  safetyProtocol: string;
}

export interface StrategicAssessment {
  reasoning: string;
  longTermRisks: string[];
  operationalPriorities: string[];
  correctiveProtocols: CorrectiveProtocol[];
  grandTotalEstimate?: number;
  groundingSources?: GroundingLink[];
}

export interface Branding {
  logo?: string;
  companyName?: string;
  primaryColor?: string;
}

export interface HistoryEntry {
  version: number;
  timestamp: string;
  author: string;
  summary: string;
  data: any;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  destination: 'User Vault' | 'Master Archive';
  status: 'Complete' | 'Failed' | 'Pending';
  path: string;
  size?: number;
}

export interface SyncStatus {
  lastSync?: string;
  isSynced: boolean;
  driveFolderId?: string;
  logs?: SyncLogEntry[];
}

export interface ReportConfig {
  showExecutiveSummary: boolean;
  showSiteIntelligence: boolean;
  showStrategicAssessment: boolean;
  showCostAnalysis: boolean;
  showDetailedImagery: boolean;
  showAuditTrail: boolean;
}

export interface InspectionReport {
  id: string;
  rootId: string;
  version: number;
  history: HistoryEntry[];
  title: string;
  client: string;
  date: string;
  industry: Industry;
  theme: ReportTheme;
  branding: Branding;
  config: ReportConfig;
  images: InspectionImage[];
  summary: string;
  recommendations: string[];
  siteContext?: SiteContext;
  strategicAssessment?: StrategicAssessment;
  metadata?: Record<string, string>;
  syncStatus?: SyncStatus;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'REVIEW' | 'FINALIZED' | 'ARCHIVED';
  approvalStatus: 'Draft' | 'Pending Review' | 'Approved' | 'Released';
}

export interface AIAnalysisResponse {
  summary: string;
  issues: {
    label: string;
    description: string;
    severity: Severity;
    confidence: number;
    location: { x: number; y: number; width: number; height: number };
    suggestedCosts?: Partial<CostEstimateItem>[];
  }[];
  recommendations: string[];
}

export enum AssetCategory {
  LBD = 'Load Balance Disconnect',
  FLIGHT_MISSION = 'Flight Mission',
  CELL_TOWER = 'Cell Tower',
  PROPERTY = 'Insurance Property',
  ROOF = 'Roof',
  UTILITY = 'Utility Asset'
}

export interface Site {
  id: string;
  name: string;
  client: string;
  location: string;
  status: 'Active' | 'Inactive' | 'Planned';
}

export interface Asset {
  id: string;
  siteId: string;
  name: string;
  category: AssetCategory;
  location: string;
  status: 'Active' | 'Inactive' | 'Maintenance' | 'Decommissioned';
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  metadata?: Record<string, any>;
}

export enum PersonnelRole {
  PILOT = 'Pilot',
  TECHNICIAN = 'Technician',
  BOTH = 'Both'
}

export interface Personnel {
  id: string;
  fullName: string;
  role: PersonnelRole;
  email: string;
  phone?: string;
  certificationLevel?: string;
  dailyPayRate?: number;
  maxTravelDistance?: number;
  status: 'Active' | 'On Leave' | 'Inactive';
  assignedAssets?: string[]; // Asset IDs
  onboarding_status?: 'not_sent' | 'sent' | 'in_progress' | 'completed';
  onboarding_sent_at?: string;
  onboarding_completed_at?: string;
}

export enum DeploymentStatus {
  DRAFT = 'Draft',
  SCHEDULED = 'Scheduled',
  ACTIVE = 'Active',
  REVIEW = 'Review',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  DELAYED = 'Delayed',
  ARCHIVED = 'Archived'
}

export enum DeploymentType {
  ROUTINE = 'Routine Inspection',
  EMERGENCY = 'Emergency Response',
  CONSTRUCTION = 'Construction Progress',
  SURVEY = 'Site Survey',
  MAINTENANCE = 'Maintenance Verification'
}

export interface DeploymentFile {
  id: string;
  name: string;
  url: string;
  type?: string;
  size?: number;
  uploadedAt?: string;
}

export interface Deployment {
  id: string;
  title: string;
  type: DeploymentType;
  status: DeploymentStatus;
  siteId?: string; // Optional link to Site
  siteName: string;
  date: string;
  technicianIds: string[]; // IDs of assigned Personnel
  notes?: string;
  location?: string;
  daysOnSite?: number;
  dailyLogs?: DailyLog[];
  files?: DeploymentFile[];
  fileCount?: number;
  personnelCount?: number;
  monitoringTeam?: MonitoringUser[];
}

export interface MonitoringUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  missionRole: string;
}

export interface DailyLog {
  id: string;
  date: string;
  technicianId: string;
  dailyPay: number;
  bonusPay?: number;
  notes?: string;
}

export interface WorkItem {
  id: string;
  workbookId: string;
  scopeType: string;
  scopeId: string;
  rowNumber: number;
  externalRowId?: string;
  title: string;
  description?: string;
  assignedUserId?: string;
  status: 'open' | 'in_progress' | 'blocked' | 'done';
  dueDate?: string;
  priority: string;
  locationJson?: any;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedByUserId?: string;
}

export interface Workbook {
  id: string;
  scopeType: string;
  scopeId: string;
  filename: string;
  storageUrl: string;
  mappingTemplateId?: string;
  uploadedBy: string;
  createdAt: string;
}

export interface GridAsset {
  id: string;
  siteId: string;
  assetKey: string;
  assetType: string;
  industry: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'complete' | 'blocked' | 'needs_review';
  plannedCount?: number;
  completedCount: number;
  assignedToUserId?: string;
  assignedToName?: string;
  assignedToAvatar?: string;
  completedAt?: string;
  completedByUserId?: string;
  lastUpdatedAt: string;
  lastUpdatedByUserId?: string;
  version: number;
  meta?: Record<string, any>;
}

export interface GridAssetEvent {
  id: string;
  assetId: string;
  eventType: 'status_change' | 'field_update' | 'comment' | 'attachment' | 'assignment';
  beforeState?: any;
  afterState?: any;
  message?: string;
  createdByUserId?: string;
  userName?: string;
  createdAt: string;
}
