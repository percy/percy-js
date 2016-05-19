const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';
const USER_AGENT = 'percy-js/1.0';

class PercyClient {
  constructor(token) {
    this._token = token;
    this.apiUrl = 'https://percy.io/api/v1';

    // Instead of a global, allow this dependency to be manually injected in tests.
    this._httpClient = require('request-promise');
  }

  _httpGet(uri) {
    let options = {
      method: 'GET',
      uri: uri,
      headers: {
        'Content-Type': JSON_API_CONTENT_TYPE,
        'Authentication': `Token token=${this._token}`,
        'User-Agent': USER_AGENT,
      },
      json: true,
      resolveWithFullResponse: true,
    };
    return this._httpClient(uri, options);
  }

  _httpPost(uri, data) {
    let options = {
      method: 'POST',
      uri: uri,
      body: data,
      headers: {
        'Content-Type': JSON_API_CONTENT_TYPE,
        'Authentication': `Token token=${this._token}`,
        'User-Agent': USER_AGENT,
      },
      json: true,
      resolveWithFullResponse: true,
    };
    return this._httpClient(uri, options);
  }

  get token() {
    return this._token;
  }

  createBuild(repo) {
    debugger
    let data = {
      data: {
        type: 'builds',
        attributes: {
          branch: 'master',
        }
      }
    };
    return this._httpPost(`${this.apiUrl}/repos/${repo}/builds/`, data);
  }
}

module.exports = PercyClient;