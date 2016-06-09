const utils = require('./utils');
const requestPromise = require('request-promise');

const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';
const USER_AGENT = 'percy-js/1.0';
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_UPLOAD_TIMEOUT_MS = DEFAULT_TIMEOUT_MS * 4;


class Resource {
  constructor(options) {
    if (!options.resourceUrl) {
      throw new Error('"resourceUrl" arg is required to create a Resource.');
    }
    if (!options.sha && !options.content) {
      throw new Error('Either "sha" or "content" is required to create a Resource.');
    }
    this.resourceUrl = options.resourceUrl;
    this.content = options.content;
    this.sha = options.sha || utils.sha256hash(options.content);
    this.mimetype = options.mimetype;
    this.isRoot = options.isRoot;

    // Temporary convenience attributes, will not be serialized. These are used, for example,
    // to hold the local path so reading file contents can be deferred.
    this.localPath = options.localPath;
  }

  serialize() {
    return {
      'type': 'resources',
      'id': this.sha,
      'attributes': {
        'resource-url': this.resourceUrl,
        'mimetype': this.mimetype || null,
        'is-root': this.isRoot || null,
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

  _httpGet(uri, options) {
    options = options || {};
    let timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    let requestOptions = {
      method: 'GET',
      uri: uri,
      headers: {
        'Authorization': `Token token=${this.token}`,
        'User-Agent': USER_AGENT,
      },
      json: true,
      resolveWithFullResponse: true,
      timeout: timeout,
    };
    return this._httpClient(uri, requestOptions);
  }

  _httpPost(uri, data, options) {
    options = options || {};
    let timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    let requestOptions = {
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
      // Don't let Percy API calls hang forever. Client libraries should be able to handle
      // rare promise rejection and nicely disable percy integration for that build.
      timeout: timeout,
    };
    return this._httpClient(uri, requestOptions);
  }

  createBuild(repo, options) {
    options = options || {};
    let data = {
      'data': {
        'type': 'builds',
        'attributes': {
          'branch': 'master',
        }
      }
    };

    if (options.resources) {
      data['data']['relationships'] = {
        'resources': {
          'data': options.resources.map(function(resource) { return resource.serialize(); }),
        },
      };
    }

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
    let options = {
      timeout: DEFAULT_UPLOAD_TIMEOUT_MS,
    }
    return this._httpPost(`${this.apiUrl}/builds/${buildId}/resources/`, data, options);
  }

  createSnapshot(buildId, resources, options) {
    options = options || {};
    resources = resources || [];
    let data = {
      'data': {
        'type': 'snapshots',
        'attributes': {
          'name': options.name || null,
          'enable-javascript': options.enableJavaScript || null,
          'widths': options.widths || null,
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