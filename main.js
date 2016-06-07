const utils = require('./utils');
const requestPromise = require('request-promise');

const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';
const USER_AGENT = 'percy-js/1.0';

class Resource {
  constructor(options) {
    if (!options.resourceUrl) {
      throw new Error('"resourceUrl" arg is required to create a Resource.');
    }
    if (!options.content) {
      throw new Error('"content" arg is required to create a Resource.');
    }
    this.resourceUrl = options.resourceUrl;
    this.content = options.content;
    this.sha = utils.sha256hash(options.content);
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
    this._httpClient = requestPromise;
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

  uploadResource(buildId, content) {
    let sha = utils.sha256hash(content);
    let data = {
      'data': {
        'type': 'resources',
        'id': sha,
        'attributes': {
          'base64-content': utils.base64encode(content),
        },
      },
    }
    return this._httpPost(`${this.apiUrl}/builds/${buildId}/resources/`, data);
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

  finalizeSnapshot(snapshotId) {
    return this._httpPost(`${this.apiUrl}/snapshots/${snapshotId}/finalize`, {});
  }

  finalizeBuild(buildId) {
    return this._httpPost(`${this.apiUrl}/builds/${buildId}/finalize`, {});
  }
}

module.exports = PercyClient;