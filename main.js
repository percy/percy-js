const http = require('http');
const https = require('https');
const utils = require('./utils');
const Environment = require('./environment');
const requestPromise = require('request-promise');

const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';
const USER_AGENT = 'percy-js/1.0';


class Resource {
  constructor(options) {
    if (!options.resourceUrl) {
      throw new Error('"resourceUrl" arg is required to create a Resource.');
    }
    if (!options.sha && !options.content) {
      throw new Error('Either "sha" or "content" is required to create a Resource.');
    }
    if (/\s/.test(options.resourceUrl)) {
      throw new Error('"resourceUrl" arg includes whitespace. It needs to be encoded.')
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
    this.environment = options.environment || new Environment(process.env);
    this._httpClient = requestPromise;
    this._httpModule = (this.apiUrl.indexOf('http://') === 0) ? http : https;
    // A custom HttpAgent with pooling and keepalive.
    this._httpAgent = new this._httpModule.Agent({maxSockets: 5, keepAlive: true});
  }

  _httpGet(uri) {
    let requestOptions = {
      method: 'GET',
      uri: uri,
      headers: {
        'Authorization': `Token token=${this.token}`,
        'User-Agent': USER_AGENT,
      },
      json: true,
      resolveWithFullResponse: true,
      agent: this._httpAgent,
    };
    return this._httpClient(uri, requestOptions);
  }

  _httpPost(uri, data) {
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
      agent: this._httpAgent,
    };
    return this._httpClient(uri, requestOptions);
  }

  createBuild(repo, options) {
    let parallelNonce = this.environment.parallelNonce;
    let parallelTotalShards = this.environment.parallelTotalShards;

    // Only pass parallelism data if it all exists.
    if (!parallelNonce || !parallelTotalShards) {
      parallelNonce = null;
      parallelTotalShards = null;
    }

    options = options || {};
    let data = {
      'data': {
        'type': 'builds',
        'attributes': {
          'branch': this.environment.branch,
          'target-branch': this.environment.targetBranch,
          'commit-sha': this.environment.commitSha,
          'pull-request-number': this.environment.pullRequestNumber,
          'parallel-nonce': parallelNonce,
          'parallel-total-shards': parallelTotalShards,
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
    return this._httpPost(`${this.apiUrl}/builds/${buildId}/resources/`, data);
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
          'minimum_height': options.minimum_height || null,
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
