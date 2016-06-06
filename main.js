const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';
const USER_AGENT = 'percy-js/1.0';

class Resource {
  constructor(options) {
    this.resourceUrl = options.resourceUrl;
    this.sha = options.sha;
    this.mimetype = options.mimetype;
    this.isRoot = options.isRoot;
  }

  serialize() {
    return {
      'type': 'resources',
      'id': this.sha,
      'attributes': {
        'resource-url': this.resourceUrl,
        'mimetype': this.mimetype,
        'is-root': this.isRoot,
      },
    }
  }
}

class PercyClient {
  constructor(options) {
    options = options || {};
    this.token = options.token;
    this.apiUrl = options.apiUrl || 'https://percy.io/api/v1';

    // Instead of a global, allow this dependency to be manually injected in tests.
    this._httpClient = require('request-promise');
  }

  _httpGet(uri) {
    let options = {
      method: 'GET',
      uri: uri,
      headers: {
        'Authorization': `Token token=${this.token}`,
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
        'Authorization': `Token token=${this.token}`,
        'User-Agent': USER_AGENT,
      },
      json: true,
      resolveWithFullResponse: true,
    };
    return this._httpClient(uri, options);
  }

  createBuild(repo) {
    let data = {
      'data': {
        'type': 'builds',
        'attributes': {
          'branch': 'master',
        }
      }
    };
    return this._httpPost(`${this.apiUrl}/repos/${repo}/builds/`, data);
  }

  makeResource(options) {
    return new Resource(options);
  }

  createSnapshot(buildId, resources, options) {
    options = options || {};
    resources = resources || [];
    let data = {
      'data': {
        'type': 'snapshots',
        'attributes': {
          'name': options.name,
          'enable-javascript': options.enableJavaScript,
          'widths': options.widths,
        },
        'relationships': {
          'resources': {
            'data': resources.map(function(resource) { return resource.serialize(); }),
          },
        },
      }
    };
    return this._httpPost(`${this.apiUrl}/builds/${buildId}/snapshots/`, data);
  }

  finalizeBuild(buildId) {
    return this._httpPost(`${this.apiUrl}/builds/${buildId}/finalize`, {});
  }
}

module.exports = PercyClient;