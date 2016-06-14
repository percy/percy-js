let path = require('path');
let Environment = require(path.join(__dirname, '..', 'environment'));
let assert = require('assert');

describe('Environment', function() {
  let environment;
  afterEach(function() {
    environment = null;
  });

  context('no known environment', function() {
    beforeEach(function() {
      environment = new Environment({});
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, null);
      assert.strictEqual(environment.commitSha, null);
      assert.strictEqual(environment.branch, 'master');
      assert.strictEqual(environment.pullRequestNumber, null);
      assert.strictEqual(environment.repo, null);
      assert.strictEqual(environment.parallelNonce, null);
      assert.strictEqual(environment.parallelTotalShards, null);
    });
  });
  context('PERCY_* env vars are set', function() {
    beforeEach(function() {
      environment = new Environment({
        PERCY_COMMIT: 'percy-commit',
        PERCY_BRANCH: 'percy-branch',
        PERCY_PULL_REQUEST: '256',
        PERCY_PROJECT: 'foo/bar',
        PERCY_PARALLEL_NONCE: 'percy-nonce',
        PERCY_PARALLEL_TOTAL: '3',
      });
    });
    it('allows override with percy env vars', function() {
      assert.strictEqual(environment.commitSha, 'percy-commit');
      assert.strictEqual(environment.branch, 'percy-branch');
      assert.strictEqual(environment.pullRequestNumber, '256');
      assert.strictEqual(environment.repo, 'foo/bar');
      assert.strictEqual(environment.parallelNonce, 'percy-nonce');
      assert.strictEqual(environment.parallelTotalShards, 3);

      // Deprecated: uses PERCY_REPO_SLUG to set project if available.
      environment._env['PERCY_REPO_SLUG'] = 'other/foo-bar';
      assert.strictEqual(environment.repo, 'other/foo-bar');
    });
  });
  context('in Travis CI', function() {
    beforeEach(function() {
      environment = new Environment({
        TRAVIS_BUILD_ID: '1234',
        TRAVIS_BUILD_NUMBER: 'build-number',
        TRAVIS_PULL_REQUEST: '256',
        TRAVIS_REPO_SLUG: 'travis/repo-slug',
        TRAVIS_COMMIT: 'travis-commit-sha',
        TRAVIS_BRANCH: 'travis-branch',
        CI_NODE_TOTAL: '3',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'travis');
      assert.strictEqual(environment.commitSha, 'travis-commit-sha');
      assert.strictEqual(environment.branch, 'travis-branch');
      assert.strictEqual(environment.pullRequestNumber, '256');
      assert.strictEqual(environment.repo, 'travis/repo-slug');
      assert.strictEqual(environment.parallelNonce, 'build-number');
      assert.strictEqual(environment.parallelTotalShards, 3);
    });
    it('branch corrects for strange Travis CI env logic', function() {
      // See note in environment branch handling.
      environment._env['TRAVIS_BRANCH'] = 'master';
      assert.strictEqual(environment.branch, 'github-pr-256');
    });
  });
  context('in Circle CI', function() {
    beforeEach(function() {
      environment = new Environment({
        CIRCLECI: 'true',
        CIRCLE_BRANCH: 'circle-branch',
        CIRCLE_SHA1: 'circle-commit-sha',
        CIRCLE_PROJECT_USERNAME: 'circle',
        CIRCLE_PROJECT_REPONAME: 'repo-name',
        CIRCLE_BUILD_NUM: 'build-number',
        CIRCLE_NODE_TOTAL: '3',
        CI_PULL_REQUESTS: 'https://github.com/owner/repo-name/pull/123',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'circle');
      assert.strictEqual(environment.commitSha, 'circle-commit-sha');
      assert.strictEqual(environment.branch, 'circle-branch');
      assert.strictEqual(environment.pullRequestNumber, '123');
      assert.strictEqual(environment.repo, 'circle/repo-name');
      assert.strictEqual(environment.parallelNonce, 'build-number');
      assert.strictEqual(environment.parallelTotalShards, 3);

      // Should be null if empty.
      environment._env['CIRCLE_NODE_TOTAL'] = '';
      assert.strictEqual(environment.parallelTotalShards, null);
    });
  });
  context('in Codeship', function() {
    beforeEach(function() {
      environment = new Environment({
        CI_NAME: 'codeship',
        CI_BRANCH: 'codeship-branch',
        CI_BUILD_NUMBER: 'codeship-build-number',
        CI_PULL_REQUEST: 'false',  // This is always false right now in Codeship. :|
        CI_COMMIT_ID: 'codeship-commit-sha',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'codeship');
      assert.strictEqual(environment.commitSha, 'codeship-commit-sha');
      assert.strictEqual(environment.branch, 'codeship-branch');
      assert.strictEqual(environment.pullRequestNumber, null);
      assert.strictEqual(environment.repo, null);
      assert.strictEqual(environment.parallelNonce, 'codeship-build-number');
      // TODO: we cannot automatically pull this from Codeship yet, they don't expose it:
      assert.strictEqual(environment.parallelTotalShards, null);
    });
  });
  context('in Drone', function() {
    beforeEach(function() {
      environment = new Environment({
        DRONE: 'true',
        DRONE_COMMIT: 'drone-commit-sha',
        DRONE_BRANCH: 'drone-branch',
        CI_PULL_REQUEST: '123',
        DRONE_BUILD_NUMBER: 'drone-build-number',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'drone');
      assert.strictEqual(environment.commitSha, 'drone-commit-sha');
      assert.strictEqual(environment.branch, 'drone-branch');
      assert.strictEqual(environment.pullRequestNumber, '123');
      assert.strictEqual(environment.repo, null);
      assert.strictEqual(environment.parallelNonce, 'drone-build-number');
      assert.strictEqual(environment.parallelTotalShards, null);
    });
  });
  context('in Semaphore CI', function() {
    beforeEach(function() {
      environment = new Environment({
        SEMAPHORE: 'true',
        BRANCH_NAME: 'semaphore-branch',
        REVISION: 'semaphore-commit-sha',
        SEMAPHORE_REPO_SLUG: 'repo-owner/repo-name',
        SEMAPHORE_BUILD_NUMBER: 'semaphore-build-number',
        SEMAPHORE_THREAD_COUNT: '2',
        PULL_REQUEST_NUMBER: '123',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'semaphore');
      assert.strictEqual(environment.commitSha, 'semaphore-commit-sha');
      assert.strictEqual(environment.branch, 'semaphore-branch');
      assert.strictEqual(environment.pullRequestNumber, '123');
      assert.strictEqual(environment.repo, 'repo-owner/repo-name');
      assert.strictEqual(environment.parallelNonce, 'semaphore-build-number');
      assert.strictEqual(environment.parallelTotalShards, 2);
    });
  });
});
