import {
  User,
  VacancySummary,
  VacancyFullDetails,
  Candidate,
  BatchPreviewResponse
} from './types';

let authToken: string | null = localStorage.getItem('pellmoor_auth_token');

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('pellmoor_auth_token', token);
  } else {
    localStorage.removeItem('pellmoor_auth_token');
  }
}

export function getToken(): string | null {
  return authToken || localStorage.getItem('pellmoor_auth_token');
}

export function generateOperationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'op-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

export interface ApiError {
  status: number;
  message: string;
  reasons?: string[];
  currentRevision?: number;
  data?: any;
}

async function apiRequest<T>(
  method: string,
  path: string,
  options: {
    body?: any;
    expectedRevision?: number;
    operationId?: string;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.operationId) {
    headers['Idempotency-Key'] = options.operationId;
  }

  if (options.expectedRevision !== undefined && options.expectedRevision !== null) {
    headers['X-Expected-Revision'] = String(options.expectedRevision);
  }

  let bodyData: string | undefined = undefined;
  if (options.body) {
    headers['Content-Type'] = 'application/json';
    const payload = { ...options.body };
    if (options.expectedRevision !== undefined && options.expectedRevision !== null && !('expected_revision' in payload)) {
      payload.expected_revision = options.expectedRevision;
    }
    bodyData = JSON.stringify(payload);
  }

  const res = await fetch(path, {
    method,
    headers,
    body: bodyData
  });

  let responseData: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      responseData = await res.json();
    } catch (e) {
      responseData = null;
    }
  } else {
    responseData = await res.text();
  }

  if (!res.ok) {
    const errorMsg = (responseData && typeof responseData === 'object' && responseData.error)
      ? responseData.error
      : `Request failed with status ${res.status}`;
    const err: ApiError = {
      status: res.status,
      message: errorMsg,
      reasons: responseData?.reasons,
      currentRevision: responseData?.current_revision,
      data: responseData
    };
    throw err;
  }

  return responseData as T;
}

// Auth APIs
export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await apiRequest<{ token: string; user: User }>('POST', '/api/auth/login', {
    body: { email, password }
  });
  setToken(res.token);
  return res;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('POST', '/api/auth/logout');
  } finally {
    setToken(null);
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    const res = await apiRequest<{ user: User }>('GET', '/api/auth/me');
    return res.user;
  } catch (err: any) {
    if (err.status === 401) {
      setToken(null);
    }
    return null;
  }
}

export async function fetchPeople(): Promise<Array<{ email: string; name: string; role: string }>> {
  const res = await apiRequest<{ people: Array<{ email: string; name: string; role: string }> }>('GET', '/api/auth/people');
  return res.people;
}

// Vacancy APIs
export async function fetchVacancies(): Promise<VacancySummary[]> {
  const res = await apiRequest<{ vacancies: VacancySummary[] }>('GET', '/api/vacancies');
  return res.vacancies;
}

export async function fetchVacancyDetails(code: string): Promise<VacancyFullDetails> {
  return await apiRequest<VacancyFullDetails>('GET', `/api/vacancies/${encodeURIComponent(code)}`);
}

// Candidate APIs
export async function fetchCandidateDetails(id: string): Promise<Candidate> {
  const res = await apiRequest<{ candidate: Candidate }>('GET', `/api/candidates/${encodeURIComponent(id)}`);
  return res.candidate;
}

export async function createCandidate(
  vacancyCode: string,
  name: string,
  expectedRevision: number,
  operationId?: string
): Promise<{ candidate: Candidate; vacancy: VacancyFullDetails }> {
  return await apiRequest<{ candidate: Candidate; vacancy: VacancyFullDetails }>('POST', '/api/candidates', {
    body: { vacancy_code: vacancyCode, name },
    expectedRevision,
    operationId
  });
}

export async function updateCandidateStage(
  candidateId: string,
  targetStage: string,
  expectedRevision: number,
  operationId?: string
): Promise<{ candidate: Candidate; vacancy: VacancyFullDetails }> {
  return await apiRequest<{ candidate: Candidate; vacancy: VacancyFullDetails }>(
    'POST',
    `/api/candidates/${encodeURIComponent(candidateId)}/stage`,
    {
      body: { target_stage: targetStage },
      expectedRevision,
      operationId
    }
  );
}

export async function updatePanelAssignment(
  candidateId: string,
  action: 'add' | 'remove',
  memberEmail: string,
  expectedRevision: number,
  operationId?: string
): Promise<{ candidate: Candidate; vacancy: VacancyFullDetails }> {
  return await apiRequest<{ candidate: Candidate; vacancy: VacancyFullDetails }>(
    'POST',
    `/api/candidates/${encodeURIComponent(candidateId)}/panel`,
    {
      body: { action, member_email: memberEmail },
      expectedRevision,
      operationId
    }
  );
}

export async function submitScore(
  candidateId: string,
  score: number,
  expectedRevision: number,
  operationId?: string
): Promise<{ candidate: Candidate; vacancy: VacancyFullDetails }> {
  return await apiRequest<{ candidate: Candidate; vacancy: VacancyFullDetails }>(
    'POST',
    `/api/candidates/${encodeURIComponent(candidateId)}/scores`,
    {
      body: { score },
      expectedRevision,
      operationId
    }
  );
}

export async function addNote(
  candidateId: string,
  text: string,
  expectedRevision: number,
  operationId?: string
): Promise<{ candidate: Candidate; vacancy: VacancyFullDetails }> {
  return await apiRequest<{ candidate: Candidate; vacancy: VacancyFullDetails }>(
    'POST',
    `/api/candidates/${encodeURIComponent(candidateId)}/notes`,
    {
      body: { text },
      expectedRevision,
      operationId
    }
  );
}

// Batch Offers APIs
export async function previewBatchOffers(
  vacancyCode: string,
  candidateIds: string[]
): Promise<BatchPreviewResponse> {
  return await apiRequest<BatchPreviewResponse>(
    'POST',
    `/api/vacancies/${encodeURIComponent(vacancyCode)}/batch-offers/preview`,
    {
      body: { candidate_ids: candidateIds }
    }
  );
}

export async function commitBatchOffers(
  vacancyCode: string,
  candidateIds: string[],
  expectedRevision: number,
  operationId?: string
): Promise<{ success: boolean; batch_id: string; batch_size: number; vacancy: VacancyFullDetails; candidates: Candidate[] }> {
  return await apiRequest<{ success: boolean; batch_id: string; batch_size: number; vacancy: VacancyFullDetails; candidates: Candidate[] }>(
    'POST',
    `/api/vacancies/${encodeURIComponent(vacancyCode)}/batch-offers`,
    {
      body: { candidate_ids: candidateIds },
      expectedRevision,
      operationId
    }
  );
}
