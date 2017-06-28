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
      assert.strictEqual(environment.targetBranch, null);
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
        PERCY_TARGET_BRANCH: 'percy-target-branch',
        PERCY_PULL_REQUEST: '256',
        PERCY_PROJECT: 'foo/bar',
        PERCY_PARALLEL_NONCE: 'percy-nonce',
        PERCY_PARALLEL_TOTAL: '3',
      });
    });

    it('allows override with percy env vars', function() {
      assert.strictEqual(environment.commitSha, 'percy-commit');
      assert.strictEqual(environment.branch, 'percy-branch');
      assert.strictEqual(environment.targetBranch, 'percy-target-branch');
      assert.strictEqual(environment.pullRequestNumber, '256');
      assert.strictEqual(environment.repo, 'foo/bar');
      assert.strictEqual(environment.parallelNonce, 'percy-nonce');
      assert.strictEqual(environment.parallelTotalShards, 3);

      // Deprecated: uses PERCY_REPO_SLUG to set project if available.
      environment._env.PERCY_REPO_SLUG = 'other/foo-bar';
      assert.strictEqual(environment.repo, 'other/foo-bar');
    });
  });

  context('in Travis CI', function() {
    beforeEach(function() {
      environment = new Environment({
        TRAVIS_BUILD_ID: '1234',
        TRAVIS_BUILD_NUMBER: 'build-number',
        TRAVIS_REPO_SLUG: 'travis/repo-slug',
        TRAVIS_PULL_REQUEST: 'false',
        TRAVIS_PULL_REQUEST_BRANCH: '',
        TRAVIS_PULL_REQUEST_SHA: '',
        TRAVIS_COMMIT: 'travis-commit-sha',
        TRAVIS_BRANCH: 'travis-branch',
        CI_NODE_TOTAL: '3',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'travis');
      assert.strictEqual(environment.commitSha, 'travis-commit-sha');
      assert.strictEqual(environment.branch, 'travis-branch');
      assert.strictEqual(environment.pullRequestNumber, null);
      assert.strictEqual(environment.repo, 'travis/repo-slug');
      assert.strictEqual(environment.parallelNonce, 'build-number');
      assert.strictEqual(environment.parallelTotalShards, 3);
    });

    context('in Pull Request build', function() {
      beforeEach(function() {
        environment._env.TRAVIS_PULL_REQUEST = '256';
        environment._env.TRAVIS_PULL_REQUEST_BRANCH = 'travis-pr-branch';
        environment._env.TRAVIS_PULL_REQUEST_SHA = 'travis-pr-head-commit-sha';
      });

      it('has the correct properties', function() {
        assert.strictEqual(environment.pullRequestNumber, '256');
        assert.strictEqual(environment.branch, 'travis-pr-branch');
        assert.strictEqual(environment.commitSha, 'travis-pr-head-commit-sha');
      });
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
      environment._env.CIRCLE_NODE_TOTAL = '';
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
        CI_NODE_TOTAL: '3',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'codeship');
      assert.strictEqual(environment.commitSha, 'codeship-commit-sha');
      assert.strictEqual(environment.branch, 'codeship-branch');
      assert.strictEqual(environment.pullRequestNumber, null);
      assert.strictEqual(environment.repo, null);
      assert.strictEqual(environment.parallelNonce, 'codeship-build-number');
      assert.strictEqual(environment.parallelTotalShards, 3);
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

  context('in Buildkite', function() {
    beforeEach(function() {
      environment = new Environment({
        BUILDKITE: 'true',
        BUILDKITE_COMMIT: 'buildkite-commit-sha',
        BUILDKITE_BRANCH: 'buildkite-branch',
        BUILDKITE_PULL_REQUEST: 'false',
        BUILDKITE_BUILD_ID: 'buildkite-build-id',
        BUILDKITE_PARALLEL_JOB_COUNT: '3',
      });
    });

    context('push build', function() {
      it('has the correct properties', function() {
        assert.strictEqual(environment.ci, 'buildkite');
        assert.strictEqual(environment.commitSha, 'buildkite-commit-sha');
        assert.strictEqual(environment.branch, 'buildkite-branch');
        assert.strictEqual(environment.pullRequestNumber, null);
        assert.strictEqual(environment.repo, null);
        assert.strictEqual(environment.parallelNonce, 'buildkite-build-id');
        assert.strictEqual(environment.parallelTotalShards, 3);
      });
    });

    context('pull request build', function() {
      beforeEach(function() {
        environment._env.BUILDKITE_PULL_REQUEST = '123';
      });

      it('has the correct properties', function() {
        assert.strictEqual(environment.pullRequestNumber, '123');
      });
    });

    context('UI-triggered HEAD build', function() {
      beforeEach(function() {
        environment._env.BUILDKITE_COMMIT = 'HEAD';
      });

      it('returns null commit SHA if set to HEAD', function() {
        assert.strictEqual(environment.commitSha, null);
      });
    });
  });
});
