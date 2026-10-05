/**
 * Thin API client.
 *
 * One place that knows about the base URL, the auth header and how the API
 * reports errors, so no component has to deal with fetch directly.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'sitelog.token';

/* localStorage can throw in private browsing, so every access is guarded. */

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Session will not survive a reload, but the app still works. */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch only rejects on a network failure, not on a 4xx or 5xx.
    throw new ApiError('No connection. Check your network and try again.', 0);
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* Some error responses carry no body. */
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error || `Request failed (${response.status}).`,
      response.status
    );
  }

  return payload;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  me: () => request('/auth/me'),

  listProjects: () => request('/projects'),
  listSites: (projectId) => request(`/projects/${projectId}/sites`),

  listReports: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/reports${query ? `?${query}` : ''}`);
  },

  getReport: (id) => request(`/reports/${id}`),

  dashboard: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/dashboard${query ? `?${query}` : ''}`);
  },

  createReport: (payload) => request('/reports', { method: 'POST', body: payload }),

  /** Photos go up separately, after the report itself has landed. */
  async uploadPhotos(reportId, files) {
    const form = new FormData();
    files.forEach((f) => form.append('photos', f));

    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(`${BASE_URL}/reports/${reportId}/photos`, {
        method: 'POST',
        headers, // no Content-Type: the browser sets the multipart boundary
        body: form,
      });
    } catch {
      throw new ApiError('Photos could not be sent. The report itself was saved.', 0);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(payload?.error || 'Photos could not be sent.', response.status);
    }
    return payload;
  },
};
