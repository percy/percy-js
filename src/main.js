const http = require('http');
const https = require('https');
const utils = require('./utils');
const Environment = require('./environment');
const UserAgent = require('./user-agent');
const retry = require('bluebird-retry');
const requestPromise = require('request-promise');
const PromisePool = require('es6-promise-pool');
const regeneratorRuntime = require('regenerator-runtime'); // eslint-disable-line no-unused-vars
const fs = require('fs');

require('dotenv').config();

const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';
const CONCURRENCY = 2;

function retryPredicate(err) {
  if (err.statusCode) {
    return err.statusCode >= 500 && err.statusCode < 600;
  } else if (err.error && !!err.error.code) {
    return err.error.code === 'ECONNRESET';
  } else {
    return false;
  }
}

class Resource {
  constructor(options) {
    if (!options.resourceUrl) {
      throw new Error('"resourceUrl" arg is required to create a Resource.');
    }
    if (!options.sha && !options.content) {
      throw new Error('Either "sha" or "content" is required to create a Resource.');
    }
    if (/\s/.test(options.resourceUrl)) {
      throw new Error('"resourceUrl" arg includes whitespace. It needs to be encoded.');
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
      type: 'resources',
      id: this.sha,
      attributes: {
        'resource-url': this.resourceUrl,
        mimetype: this.mimetype || null,
        'is-root': this.isRoot || null,
      },
    };
  }
}

class PercyClient {
  constructor(options) {
    options = options || {};
    this.token = options.token;
    this.apiUrl = options.apiUrl || 'https://percy.io/api/v1';
    this.environment = options.environment || new Environment(process.env);
    this._httpClient = requestPromise;
    this._httpModule = this.apiUrl.indexOf('http://') === 0 ? http : https;
    // A custom HttpAgent with pooling and keepalive.
    this._httpAgent = new this._httpModule.Agent({
      maxSockets: 5,
      keepAlive: true,
    });
    this._clientInfo = options.clientInfo;
    this._environmentInfo = options.environmentInfo;
    this._sdkClientInfo = null;
    this._sdkEnvironmentInfo = null;
  }

  _headers(headers) {
    return Object.assign(
      {
        Authorization: `Token token=${this.token}`,
        'User-Agent': new UserAgent(this).toString(),
      },
      headers,
    );
  }

  _httpGet(uri) {
    let requestOptions = {
      method: 'GET',
      uri: uri,
      headers: this._headers(),
      json: true,
      resolveWithFullResponse: true,
      agent: this._httpAgent,
    };

    return retry(this._httpClient, {
      context: this,
      args: [uri, requestOptions],
      interval: 50,
      max_tries: 5,
      throw_original: true,
      predicate: retryPredicate,
    });
  }

  _httpPost(uri, data) {
    let requestOptions = {
      method: 'POST',
      uri: uri,
      body: data,
      headers: this._headers({'Content-Type': JSON_API_CONTENT_TYPE}),
      json: true,
      resolveWithFullResponse: true,
      agent: this._httpAgent,
    };

    return retry(this._httpClient, {
      context: this,
      args: [uri, requestOptions],
      interval: 50,
      max_tries: 5,
      throw_original: true,
      predicate: retryPredicate,
    });
  }

  createBuild(options) {
    let parallelNonce = this.environment.parallelNonce;
    let parallelTotalShards = this.environment.parallelTotalShards;

    // Only pass parallelism data if it all exists.
    if (!parallelNonce || !parallelTotalShards) {
      parallelNonce = null;
      parallelTotalShards = null;
    }

    options = options || {};

    const commitData = options['commitData'] || this.environment.commitData;

    let data = {
      data: {
        type: 'builds',
        attributes: {
          branch: commitData.branch,
          'target-branch': this.environment.targetBranch,
          'target-commit-sha': this.environment.targetCommitSha,
          'commit-sha': commitData.sha,
          'commit-committed-at': commitData.committedAt,
          'commit-author-name': commitData.authorName,
          'commit-author-email': commitData.authorEmail,
          'commit-committer-name': commitData.committerName,
          'commit-committer-email': commitData.committerEmail,
          'commit-message': commitData.message,
          'pull-request-number': this.environment.pullRequestNumber,
          'parallel-nonce': parallelNonce,
          'parallel-total-shards': parallelTotalShards,
          partial: this.environment.partialBuild,
        },
      },
    };

    if (options.resources) {
      data['data']['relationships'] = {
        resources: {
          data: options.resources.map(function(resource) {
            return resource.serialize();
          }),
        },
      };
    }

    return this._httpPost(`${this.apiUrl}/builds/`, data);
  }

  // This method is unavailable to normal write-only project tokens.
  getBuild(buildId) {
    return this._httpGet(`${this.apiUrl}/builds/${buildId}`);
  }

  // This method is unavailable to normal write-only project tokens.
  getBuilds(project, filter) {
    filter = filter || {};
    let queryString = Object.keys(filter)
      .map(key => {
        if (Array.isArray(filter[key])) {
          // If filter value is an array, match Percy API's format expectations of:
          //   filter[key][]=value1&filter[key][]=value2
          return filter[key].map(array_value => `filter[${key}][]=${array_value}`).join('&');
        } else {
          return 'filter[' + key + ']=' + filter[key];
        }
      })
      .join('&');

    if (queryString.length > 0) {
      queryString = '?' + queryString;
    }

    return this._httpGet(`${this.apiUrl}/projects/${project}/builds${queryString}`);
  }

  makeResource(options) {
    return new Resource(options);
  }

  // Synchronously walks a directory of compiled assets and returns an array of Resource objects.
  gatherBuildResources(rootDir, options) {
    return utils.gatherBuildResources(this, rootDir, options);
  }

  uploadResource(buildId, content) {
    let sha = utils.sha256hash(content);
    let data = {
      data: {
        type: 'resources',
        id: sha,
        attributes: {
          'base64-content': utils.base64encode(content),
        },
      },
    };

    return this._httpPost(`${this.apiUrl}/builds/${buildId}/resources/`, data);
  }

  uploadResources(buildId, resources) {
    const _this = this;
    function* generatePromises() {
      for (const resource of resources) {
        const content = resource.localPath ? fs.readFileSync(resource.localPath) : resource.content;
        yield _this.uploadResource(buildId, content);
      }
    }

    const pool = new PromisePool(generatePromises(), CONCURRENCY);
    return pool.start();
  }

  uploadMissingResources(buildId, response, resources) {
    const missingResourceShas = utils.getMissingResources(response);
    if (!missingResourceShas.length) {
      return Promise.resolve();
    }

    const resourcesBySha = resources.reduce((map, resource) => {
      map[resource.sha] = resource;
      return map;
    }, {});
    const missingResources = missingResourceShas.map(resource => resourcesBySha[resource.id]);

    return this.uploadResources(buildId, missingResources);
  }

  createSnapshot(buildId, resources, options) {
    options = options || {};
    resources = resources || [];

    let data = {
      data: {
        type: 'snapshots',
        attributes: {
          name: options.name || null,
          'enable-javascript': options.enableJavaScript || null,
          widths: options.widths || null,
          'minimum-height': options.minimumHeight || null,
        },
        relationships: {
          resources: {
            data: resources.map(function(resource) {
              return resource.serialize();
            }),
          },
        },
      },
    };

    this._sdkClientInfo = options.clientInfo;
    this._sdkEnvironmentInfo = options.environmentInfo;
    return this._httpPost(`${this.apiUrl}/builds/${buildId}/snapshots/`, data);
  }

  finalizeSnapshot(snapshotId) {
    return this._httpPost(`${this.apiUrl}/snapshots/${snapshotId}/finalize`, {});
  }

  finalizeBuild(buildId, options) {
    options = options || {};
    let allShards = options.allShards || false;
    let query = allShards ? '?all-shards=true' : '';
    return this._httpPost(`${this.apiUrl}/builds/${buildId}/finalize${query}`, {});
  }
}

module.exports = PercyClient;
