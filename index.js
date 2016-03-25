class PercyClient {
  constructor(token) {
    this._token = token;
    this.apiUrl = 'https://percy.io/api/v1';

    // Instead of a global for fetchMock, allow this dependency to be manually injected in tests.
    this._fetch = require('node-fetch');
  }

  get token() {
    return this._token;
  }

  _http_get(url) {
    return this._fetch(url, {
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authentication': `Token token=${this._token}`,
      }
    });
  }

  _http_post(url, data) {
    return this._fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authentication': `Token token=${this._token}`,
      }
    });
  }

  createBuild(repo) {
    let data = {
      data: {
        type: 'builds',
        attributes: {
          branch: 'master',
        }
      }
    };
    return this._http_post(`${this.apiUrl}/repos/${repo}/builds/`, data);
  }
}

module.exports = PercyClient;