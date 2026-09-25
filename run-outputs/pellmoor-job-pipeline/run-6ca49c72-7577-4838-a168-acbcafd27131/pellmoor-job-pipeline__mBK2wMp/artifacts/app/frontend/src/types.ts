export type Role = 'hiring manager' | 'panel' | 'coordinator';

export type Stage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn';

export interface User {
  email: string;
  name: string;
  role: Role;
}

export interface VacancySummary {
  code: string;
  title: string;
  team: string;
  openings: number;
  revision: number;
  reserved: number;
  filled: number;
  available: number;
  candidate_count: number;
}

export interface FunnelStageData {
  reached: number;
  remain: number;
  lost: number;
}

export interface FunnelData {
  applied: FunnelStageData;
  screening: FunnelStageData;
  interview: FunnelStageData;
  offer: FunnelStageData;
  hired: FunnelStageData;
}

export interface PanelMember {
  email: string;
  name: string;
}

export interface ScoreRecord {
  assessment_version: number;
  scorer_email: string;
  scorer_name: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface NoteRecord {
  id: number;
  author_email: string;
  author_name: string;
  text: string;
  created_at: string;
}

export interface OfferEligibility {
  eligible: boolean;
  reasons: string[];
}

export interface Candidate {
  id: string;
  vacancy_code: string;
  name: string;
  stage: Stage;
  days_since_applied: number;
  assessment_version: number;
  history: Stage[];
  panel: PanelMember[];
  current_scores: ScoreRecord[];
  historical_scores: ScoreRecord[];
  notes: NoteRecord[];
  offer_eligibility: OfferEligibility;
  is_frozen: boolean;
  is_terminal: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityEvent {
  id: number;
  vacancy_code: string;
  candidate_id: string | null;
  actor_email: string;
  actor_name: string;
  action_type: string;
  description: string;
  details: Record<string, any>;
  created_at: string;
}

export interface VacancyFullDetails {
  vacancy: VacancySummary;
  funnel: FunnelData;
  candidates: Candidate[];
  activity: ActivityEvent[];
}

export interface BatchCandidatePreview {
  id: string;
  name: string;
  stage: string;
  assessment_version: number;
  eligible: boolean;
  reasons: string[];
}

export interface BatchPreviewResponse {
  vacancy_code: string;
  selected_count: number;
  current_capacity: {
    openings: number;
    reserved: number;
    filled: number;
    available: number;
    revision: number;
  };
  projected_capacity: {
    openings: number;
    reserved: number;
    filled: number;
    available: number;
  };
  candidates: BatchCandidatePreview[];
  batch_eligible: boolean;
  batch_ineligible_reasons: string[];
}
