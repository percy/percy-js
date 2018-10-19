let path = require('path');
let Environment = require(path.join(__dirname, '..', 'src', 'environment'));
let assert = require('assert');
let sinon = require('sinon');

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
      assert(typeof environment.branch == 'string');
      assert.strictEqual(environment.ci, null);
      assert.strictEqual(environment.commitSha, null);
      assert.strictEqual(environment.targetBranch, null);
      assert.strictEqual(environment.pullRequestNumber, null);
      assert.strictEqual(environment.parallelNonce, null);
      assert.strictEqual(environment.parallelTotalShards, null);
    });

    it('commitData reads and parses live git commit information', function() {
      // This checks the real information coming from rawCommitData is in the
      // expected format and can be correctly parsed.
      // Test for typeof string here rather than specific values because
      // these tests check that git info can be read from the local filesystem,
      // so all of the values will change between commits.
      let commit = environment.commitData;
      assert(typeof commit.branch == 'string');
      assert(typeof commit.sha == 'string');
      assert(typeof commit.authorName == 'string');
      assert(typeof commit.authorEmail == 'string');
      assert(typeof commit.committerName == 'string');
      assert(typeof commit.committerEmail == 'string');
      assert(typeof commit.committedAt == 'string');
      assert(typeof commit.message == 'string');
    });

    it('commitData correctly parses rawCommitData', function() {
      let commitStub = sinon.stub(environment, 'rawCommitData')
        .returns(`COMMIT_SHA:620804c296827012104931d44b001f20eda9dbeb
AUTHOR_NAME:Tim Haines
AUTHOR_EMAIL:timhaines@example.com
COMMITTER_NAME:Other Tim Haines
COMMITTER_EMAIL:othertimhaines@example.com
COMMITTED_DATE:2018-03-07 16:40:12 -0800
COMMIT_MESSAGE:Sinon stubs are lovely`);
      let branchStub = sinon.stub(environment, 'rawBranch').returns('test-branch');
      let commit = environment.commitData;
      assert.strictEqual(commit.branch, 'test-branch');
      assert.strictEqual(commit.sha, '620804c296827012104931d44b001f20eda9dbeb');
      assert.strictEqual(commit.authorName, 'Tim Haines');
      assert.strictEqual(commit.authorEmail, 'timhaines@example.com');
      assert.strictEqual(commit.committerName, 'Other Tim Haines');
      assert.strictEqual(commit.committerEmail, 'othertimhaines@example.com');
      assert.strictEqual(commit.committedAt, '2018-03-07 16:40:12 -0800');
      assert.strictEqual(commit.message, 'Sinon stubs are lovely');
      commitStub.restore();
      branchStub.restore();
    });

    it('commitData returns branch only when git commit cannot be read', function() {
      let commitStub = sinon.stub(environment, 'rawCommitData').returns('');
      let branchStub = sinon.stub(environment, 'rawBranch').returns('test-branch');
      let commit = environment.commitData;
      assert.strictEqual(commit.branch, 'test-branch');
      assert.strictEqual(commit.sha, null);
      commitStub.restore();
      branchStub.restore();
    });

    it('branch returns null when git branch cannot be read', function() {
      let branchStub = sinon.stub(environment, 'rawBranch').returns('');
      assert.strictEqual(environment.branch, null);
      branchStub.restore();
    });
  });

  context('PERCY_* env vars are set', function() {
    beforeEach(function() {
      environment = new Environment({
        PERCY_COMMIT: 'percy-commit',
        PERCY_BRANCH: 'percy-branch',
        PERCY_TARGET_BRANCH: 'percy-target-branch',
        PERCY_TARGET_COMMIT: 'percy-target-commit',
        PERCY_PULL_REQUEST: '256',
        PERCY_PARALLEL_NONCE: 'percy-nonce',
        PERCY_PARALLEL_TOTAL: '3',
        GIT_AUTHOR_NAME: 'git author',
        GIT_AUTHOR_EMAIL: 'gitauthor@example.com',
        GIT_COMMITTER_NAME: 'git committer',
        GIT_COMMITTER_EMAIL: 'git committer@example.com',
      });
    });

    it('allows override with percy env vars', function() {
      assert.strictEqual(environment.commitSha, 'percy-commit');
      assert.strictEqual(environment.targetCommitSha, 'percy-target-commit');
      assert.strictEqual(environment.branch, 'percy-branch');
      assert.strictEqual(environment.targetBranch, 'percy-target-branch');
      assert.strictEqual(environment.pullRequestNumber, '256');
      assert.strictEqual(environment.parallelNonce, 'percy-nonce');
      assert.strictEqual(environment.parallelTotalShards, 3);
    });

    it('commitData returns ENV vars when git cannot be read', function() {
      let commitStub = sinon.stub(environment, 'rawCommitData').returns('');
      let branchStub = sinon.stub(environment, 'rawBranch').returns('');

      let commit = environment.commitData;
      assert.strictEqual(commit.branch, 'percy-branch');
      assert.strictEqual(commit.sha, 'percy-commit');
      assert.strictEqual(commit.authorName, 'git author');
      assert.strictEqual(commit.authorEmail, 'gitauthor@example.com');
      assert.strictEqual(commit.committerName, 'git committer');
      assert.strictEqual(commit.committerEmail, 'git committer@example.com');
      assert.strictEqual(commit.committedAt, undefined);
      assert.strictEqual(commit.message, undefined);

      commitStub.restore();
      branchStub.restore();
    });
  });

  context('in Travis CI', function() {
    beforeEach(function() {
      environment = new Environment({
        TRAVIS_BUILD_ID: '1234',
        TRAVIS_BUILD_NUMBER: 'build-number',
        TRAVIS_PULL_REQUEST: 'false',
        TRAVIS_PULL_REQUEST_BRANCH: '',
        TRAVIS_COMMIT: 'travis-commit-sha',
        TRAVIS_BRANCH: 'travis-branch',
        CI_NODE_TOTAL: '3',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'travis');
      assert.strictEqual(environment.commitSha, 'travis-commit-sha');
      assert.strictEqual(environment.targetCommitSha, null);
      assert.strictEqual(environment.branch, 'travis-branch');
      assert.strictEqual(environment.targetBranch, null);
      assert.strictEqual(environment.pullRequestNumber, null);
      assert.strictEqual(environment.parallelNonce, 'build-number');
      assert.strictEqual(environment.parallelTotalShards, 3);
    });

    context('in Pull Request build', function() {
      beforeEach(function() {
        environment._env.TRAVIS_PULL_REQUEST = '256';
        environment._env.TRAVIS_PULL_REQUEST_BRANCH = 'travis-pr-branch';
      });

      it('has the correct properties', function() {
        assert.strictEqual(environment.pullRequestNumber, '256');
        assert.strictEqual(environment.branch, 'travis-pr-branch');
        assert.strictEqual(environment.targetBranch, null);
        assert.strictEqual(environment.commitSha, 'travis-commit-sha');
        assert.strictEqual(environment.targetCommitSha, null);
      });
    });
  });

  context('in Jenkins', function() {
    beforeEach(function() {
      environment = new Environment({
        JENKINS_URL: 'http://jenkins.local/',
        BUILD_NUMBER: '111',
        ghprbPullId: '256',
        ghprbActualCommit: 'jenkins-commit-sha',
        ghprbSourceBranch: 'jenkins-branch',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'jenkins');
      assert.strictEqual(environment.commitSha, 'jenkins-commit-sha');
      assert.strictEqual(environment.targetCommitSha, null);
      assert.strictEqual(environment.branch, 'jenkins-branch');
      assert.strictEqual(environment.targetBranch, null);
      assert.strictEqual(environment.pullRequestNumber, '256');
      assert.strictEqual(environment.parallelNonce, '111');
      assert.strictEqual(environment.parallelTotalShards, null);
    });
  });

  context('in Circle CI', function() {
    beforeEach(function() {
      environment = new Environment({
        CIRCLECI: 'true',
        CIRCLE_BRANCH: 'circle-branch',
        CIRCLE_SHA1: 'circle-commit-sha',
        CIRCLE_BUILD_NUM: 'build-number',
        CIRCLE_NODE_TOTAL: '3',
        CI_PULL_REQUESTS: 'https://github.com/owner/repo-name/pull/123',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'circle');
      assert.strictEqual(environment.commitSha, 'circle-commit-sha');
      assert.strictEqual(environment.targetCommitSha, null);
      assert.strictEqual(environment.branch, 'circle-branch');
      assert.strictEqual(environment.targetBranch, null);
      assert.strictEqual(environment.pullRequestNumber, '123');
      assert.strictEqual(environment.parallelNonce, 'build-number');
      assert.strictEqual(environment.parallelTotalShards, 3);

      // Should be null if empty.
      environment._env.CIRCLE_NODE_TOTAL = '';
      assert.strictEqual(environment.parallelTotalShards, null);
    });

    context('in Circle 2.0', function() {
      it('has the correct properties', function() {
        environment._env.CIRCLE_WORKFLOW_WORKSPACE_ID = 'circle-workflow-workspace-id';
        assert.strictEqual(environment.parallelNonce, 'circle-workflow-workspace-id');
      });
    });
  });

  context('in Codeship', function() {
    beforeEach(function() {
      environment = new Environment({
        CI_NAME: 'codeship',
        CI_BRANCH: 'codeship-branch',
        CI_BUILD_NUMBER: 'codeship-build-number',
        CI_PULL_REQUEST: 'false', // This is always false right now in Codeship. :|
        CI_COMMIT_ID: 'codeship-commit-sha',
        CI_NODE_TOTAL: '3',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'codeship');
      assert.strictEqual(environment.commitSha, 'codeship-commit-sha');
      assert.strictEqual(environment.targetCommitSha, null);
      assert.strictEqual(environment.branch, 'codeship-branch');
      assert.strictEqual(environment.targetBranch, null);
      assert.strictEqual(environment.pullRequestNumber, null);
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
      assert.strictEqual(environment.targetCommitSha, null);
      assert.strictEqual(environment.branch, 'drone-branch');
      assert.strictEqual(environment.targetBranch, null);
      assert.strictEqual(environment.pullRequestNumber, '123');
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
        SEMAPHORE_BRANCH_ID: 'semaphore-branch-id',
        SEMAPHORE_BUILD_NUMBER: 'semaphore-build-number',
        SEMAPHORE_THREAD_COUNT: '2',
        PULL_REQUEST_NUMBER: '123',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'semaphore');
      assert.strictEqual(environment.commitSha, 'semaphore-commit-sha');
      assert.strictEqual(environment.targetCommitSha, null);
      assert.strictEqual(environment.branch, 'semaphore-branch');
      assert.strictEqual(environment.targetBranch, null);
      assert.strictEqual(environment.pullRequestNumber, '123');
      let expected_nonce = 'semaphore-branch-id/semaphore-build-number';
      assert.strictEqual(environment.parallelNonce, expected_nonce);
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
        assert.strictEqual(environment.targetCommitSha, null);
        assert.strictEqual(environment.branch, 'buildkite-branch');
        assert.strictEqual(environment.targetBranch, null);
        assert.strictEqual(environment.pullRequestNumber, null);
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

  context('in GitLab', function() {
    beforeEach(function() {
      environment = new Environment({
        GITLAB_CI: 'true',
        CI_COMMIT_SHA: 'gitlab-commit-sha',
        CI_COMMIT_REF_NAME: 'gitlab-branch',
        CI_JOB_ID: 'gitlab-job-id',
        CI_SERVER_VERSION: '8.14.3-ee',
      });
    });

    context('push build', function() {
      it('has the correct properties', function() {
        assert.strictEqual(environment.ci, 'gitlab');
        assert.strictEqual(environment.commitSha, 'gitlab-commit-sha');
        assert.strictEqual(environment.targetCommitSha, null);
        assert.strictEqual(environment.branch, 'gitlab-branch');
        assert.strictEqual(environment.targetBranch, null);
        assert.strictEqual(environment.pullRequestNumber, null);
        assert.strictEqual(environment.parallelNonce, 'gitlab-job-id');
        assert.strictEqual(environment.parallelTotalShards, null);
      });
    });
  });

  context('in Heroku CI', function() {
    beforeEach(function() {
      environment = new Environment({
        HEROKU_TEST_RUN_COMMIT_VERSION: 'heroku-commit-sha',
        HEROKU_TEST_RUN_BRANCH: 'heroku-branch',
        HEROKU_TEST_RUN_ID: 'heroku-test-run-id',
        // TODO(fotinakis): need this.
        // HEROKU_PULL_REQUEST: '123',
        CI_NODE_TOTAL: '3',
      });
    });

    it('has the correct properties', function() {
      assert.strictEqual(environment.ci, 'heroku');
      assert.strictEqual(environment.commitSha, 'heroku-commit-sha');
      assert.strictEqual(environment.targetCommitSha, null);
      assert.strictEqual(environment.branch, 'heroku-branch');
      assert.strictEqual(environment.targetBranch, null);
      assert.strictEqual(environment.pullRequestNumber, null);
      assert.strictEqual(environment.parallelNonce, 'heroku-test-run-id');
      assert.strictEqual(environment.parallelTotalShards, 3);
    });
  });
});
