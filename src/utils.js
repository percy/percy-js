const crypto = require('crypto');
const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');
const retry = require('promise-retry');
const walk = require('walk');

const MAX_FILE_SIZE_BYTES = 15728640; // 15MB.

module.exports = {
  sha256hash(content) {
    return crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
  },

  base64encode(content) {
    return Buffer.from(content).toString('base64');
  },

  getMissingResources(response) {
    return (
      (response &&
        response.body &&
        response.body.data &&
        response.body.data.relationships &&
        response.body.data.relationships['missing-resources'] &&
        response.body.data.relationships['missing-resources'].data) ||
      []
    );
  },

  retryRequest(uri, requestOptions) {
    return retry(
      retry =>
        fetch(uri, requestOptions)
          .then(res => {
            return res.json().then(body => {
              let response = {
                statusCode: res.status,
                statusMessage: res.statusText,
                headers: res.headers.raw(),
                mehod: res.method,
                url: res.url,
                body,
              };

              if (!res.ok) {
                throw Object.assign(new Error(), {
                  message: `${res.status} - ${JSON.stringify(body)}`,
                  statusCode: res.status,
                  response,
                });
              }

              return response;
            });
          })
          .catch(err => {
            if (err.statusCode >= 500 && err.statusCode < 600) {
              return retry(err);
            } else {
              return Promise.reject(err);
            }
          }),
      {
        retries: 4,
        minTimeout: 50,
        factor: 1,
      },
    );
  },

  // Synchronously walk a directory of compiled assets, read each file and calculate its SHA 256
  // hash, and create an array of Resource objects.
  gatherBuildResources(percyClient, rootDir, options = {}) {
    // The base of the URL that will be prepended to every resource URL, such as "/assets".
    options.baseUrlPath = options.baseUrlPath || '';
    options.skippedPathRegexes = options.skippedPathRegexes || [];
    options.followLinks = options.followLinks || true;

    let resources = [];

    let fileWalker = function(root, fileStats, next) {
      let absolutePath = path.join(root, fileStats.name);
      let resourceUrl = absolutePath.replace(rootDir, '');

      if (path.sep == '\\') {
        // Windows support: transform filesystem backslashes into forward-slashes for the URL.
        resourceUrl = resourceUrl.replace(/\\/g, '/');
      }

      // Prepend the baseUrlPath if it is given. We normalize it to make sure it does not have
      // a trailing slash, or it's a blank string.
      let normalizedBaseUrlPath = (options.baseUrlPath || '/').replace(/\/$/, '');
      resourceUrl = normalizedBaseUrlPath + resourceUrl;

      // Skip excluded paths.
      for (let i in options.skippedPathRegexes) {
        if (resourceUrl.match(options.skippedPathRegexes[i])) {
          next();
          return;
        }
      }

      // Skip large files.
      if (fs.statSync(absolutePath)['size'] > MAX_FILE_SIZE_BYTES) {
        // eslint-disable-next-line no-console
        console.warn('\n[percy][WARNING] Skipping large build resource: ', resourceUrl);
        return;
      }

      // Note: this is synchronous and potentially memory intensive, but we don't keep a
      // reference to the content around so each should be garbage collected. Reevaluate?
      let content = fs.readFileSync(absolutePath);
      let sha = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');

      let resource = percyClient.makeResource({
        resourceUrl: encodeURI(resourceUrl),
        sha: sha,
        localPath: absolutePath,
      });

      resources.push(resource);
      next();
    };

    let walkOptions = {
      // Follow symlinks because assets may be just symlinks.
      followLinks: options.followLinks,
      listeners: {
        file: fileWalker,
      },
    };
    walk.walkSync(rootDir, walkOptions);

    return resources;
  },

  reverseString(str) {
    return str
      .split('')
      .reverse()
      .join('');
  },
};
