/**
 * E2E API Client Helper for SQDIS Live Backend
 * Supports REST methods, JSON and multipart payloads, JWT & tenant header management
 */

export class ApiClient {
  constructor(baseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = null;
    this.organizationId = null;
  }

  setToken(token) {
    this.token = token;
    return this;
  }

  setOrganizationId(orgId) {
    this.organizationId = orgId;
    return this;
  }

  clone() {
    const copy = new ApiClient(this.baseUrl);
    copy.token = this.token;
    copy.organizationId = this.organizationId;
    return copy;
  }

  async request(method, endpoint, options = {}) {
    let url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;

    if (options.params) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => query.append(key, String(v)));
          } else {
            query.append(key, String(value));
          }
        }
      }
      const qs = query.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const headers = { ...options.headers };

    if (this.token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.organizationId && !headers['X-Organization-Id'] && !headers['x-organization-id']) {
      headers['X-Organization-Id'] = this.organizationId;
    }

    let body = options.body;
    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.json);
    } else if (options.formData) {
      // Let fetch handle boundary for FormData
      body = options.formData;
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    const contentType = response.headers.get('content-type') || '';
    let data = null;
    let rawText = '';

    try {
      rawText = await response.text();
      if (contentType.includes('application/json') || rawText.startsWith('{') || rawText.startsWith('[')) {
        data = JSON.parse(rawText);
      } else {
        data = rawText;
      }
    } catch {
      data = rawText;
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      data,
      rawText,
    };
  }

  get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }

  post(endpoint, body, options = {}) {
    if (body instanceof FormData) {
      return this.request('POST', endpoint, { ...options, formData: body });
    }
    return this.request('POST', endpoint, { ...options, json: body });
  }

  patch(endpoint, body, options = {}) {
    return this.request('PATCH', endpoint, { ...options, json: body });
  }

  put(endpoint, body, options = {}) {
    return this.request('PUT', endpoint, { ...options, json: body });
  }

  delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, options);
  }
}

export const defaultClient = new ApiClient();
