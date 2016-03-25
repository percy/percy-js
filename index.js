var fetch = require('node-fetch');

class PercyClient {
  constructor(token) {
    this._token = token;
    this.apiUrl = 'https://percy.io/api/v1';
  }

  get token() {
    return this._token;
  }

  set token(value) {
    this._token = value;
  }

  createBuild(repo) {
    let body = {};

    return fetch(`${this.apiUrl}/repos/${repo}/builds/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

module.exports = PercyClient;