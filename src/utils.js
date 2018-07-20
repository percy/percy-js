const base64 = require('base64-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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
    return base64.fromByteArray(new Buffer(content));
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
};
