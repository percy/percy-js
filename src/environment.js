const GIT_FORMAT_LINES = [
  'COMMIT_SHA:%H',
  'AUTHOR_NAME:%an',
  'AUTHOR_EMAIL:%ae',
  'COMMITTER_NAME:%an',
  'COMMITTER_EMAIL:%ae',
  'COMMITTED_DATE:%ai',
  // Note: order is important, this must come last because the regex is a multiline match.
  'COMMIT_MESSAGE:%B',
];

class Environment {
  constructor(env) {
    if (!env) {
      throw new Error('"env" arg is required to create an Environment.');
    }
    this._env = env;
  }

  get ci() {
    if (this._env.TRAVIS_BUILD_ID) {
      return 'travis';
    } else if (this._env.JENKINS_URL && this._env.ghprbPullId) {
      // Pull Request Builder plugin.
      return 'jenkins';
    } else if (this._env.CIRCLECI) {
      return 'circle';
    } else if (this._env.CI_NAME && this._env.CI_NAME == 'codeship') {
      return 'codeship';
    } else if (this._env.DRONE == 'true') {
      return 'drone';
    } else if (this._env.SEMAPHORE == 'true') {
      return 'semaphore';
    } else if (this._env.BUILDKITE == 'true') {
      return 'buildkite';
    }
    return null;
  }

  rawCommitData(commitSha) {
    // Make sure commitSha is only alphanumeric characters to prevent command injection.
    if (commitSha.length > 100 || !commitSha.match(/^[0-9a-zA-Z]+$/)) {
      return '';
    }

    const child_process = require('child_process');
    const format = GIT_FORMAT_LINES.join('%n'); // git show format uses %n for newlines.
    const cmd = `git show ${commitSha} --quiet --format="${format}"`;

    try {
      return child_process
        .execSync(cmd)
        .toString()
        .trim();
    } catch (error) {
      return '';
    }
  }

  get commitData() {
    let output = '';
    if (this.commitSha) {
      output = this.rawCommitData(this.commitSha);
    }
    if (!output || output == '') {
      output = this.rawCommitData('HEAD');
    }

    // If rawCommitData can't be read, return the branch only.
    if (output == '') {
      return {
        branch: this.branch,
      };
    }

    // If not running in a git repo, allow undefined for certain commit attributes.
    const parse = regex => {
      return ((output && output.match(regex)) || [])[1];
    };

    return {
      // The only required attribute:
      branch: this.branch,
      // An optional but important attribute:
      sha: this.commitSha || parse(/COMMIT_SHA:(.*)/),

      // Optional attributes:
      message: parse(/COMMIT_MESSAGE:(.*)/m),
      committedAt: parse(/COMMITTED_DATE:(.*)/),

      // These GIT_ environment vars are from the Jenkins Git Plugin, but could be
      // used generically. This behavior may change in the future.
      authorName: parse(/AUTHOR_NAME:(.*)/) || this._env['GIT_AUTHOR_NAME'],
      authorEmail: parse(/AUTHOR_EMAIL:(.*)/) || this._env['GIT_AUTHOR_EMAIL'],
      committerName: parse(/COMMITTER_NAME:(.*)/) || this._env['GIT_COMMITTER_NAME'],
      committerEmail: parse(/COMMITTER_EMAIL:(.*)/) || this._env['GIT_COMMITTER_EMAIL'],
    };
  }

  get commitSha() {
    if (this._env.PERCY_COMMIT) {
      return this._env.PERCY_COMMIT;
    }
    switch (this.ci) {
      case 'travis':
        if (this.pullRequestNumber && this._env.TRAVIS_PULL_REQUEST_SHA) {
          return this._env.TRAVIS_PULL_REQUEST_SHA;
        }
        return this._env.TRAVIS_COMMIT;
      case 'jenkins':
        // Pull Request Builder Plugin OR Git Plugin.
        return this._env.ghprbActualCommit || this._env.GIT_COMMIT;
      case 'circle':
        return this._env.CIRCLE_SHA1;
      case 'codeship':
        return this._env.CI_COMMIT_ID;
      case 'drone':
        return this._env.DRONE_COMMIT;
      case 'semaphore':
        return this._env.REVISION;
      case 'buildkite': {
        let commitSha = this._env.BUILDKITE_COMMIT;
        // Buildkite mixes SHAs and non-SHAs in BUILDKITE_COMMIT, so we return null if non-SHA.
        return commitSha !== 'HEAD' ? this._env.BUILDKITE_COMMIT : null;
      }
    }

    return null;
  }

  get branch() {
    if (this._env.PERCY_BRANCH) {
      return this._env.PERCY_BRANCH;
    }
    let result = '';
    switch (this.ci) {
      case 'travis':
        if (this.pullRequestNumber && this._env.TRAVIS_PULL_REQUEST_BRANCH) {
          result = this._env.TRAVIS_PULL_REQUEST_BRANCH;
        } else {
          result = this._env.TRAVIS_BRANCH;
        }
        break;
      case 'jenkins':
        result = this._env.ghprbSourceBranch;
        break;
      case 'circle':
        result = this._env.CIRCLE_BRANCH;
        break;
      case 'codeship':
        result = this._env.CI_BRANCH;
        break;
      case 'drone':
        result = this._env.DRONE_BRANCH;
        break;
      case 'semaphore':
        result = this._env.BRANCH_NAME;
        break;
      case 'buildkite':
        result = this._env.BUILDKITE_BRANCH;
        break;
    }

    if (result == '') {
      result = this.rawBranch();
    }

    if (result == '') {
      // Branch not specified
      result = null;
    }

    return result;
  }

  rawBranch() {
    const child_process = require('child_process');
    const cmd = 'git rev-parse --abbrev-ref HEAD';
    try {
      return child_process
        .execSync(cmd)
        .toString()
        .trim();
    } catch (error) {
      return '';
    }
  }

  get targetBranch() {
    return this._env.PERCY_TARGET_BRANCH || null;
  }

  get project() {
    return this._env.PERCY_PROJECT || null;
  }

  // Deprecated: use `project` instead.
  get repo() {
    if (this._env.PERCY_REPO_SLUG || this._env.PERCY_PROJECT) {
      return this._env.PERCY_REPO_SLUG || this._env.PERCY_PROJECT;
    }
    // Deprecated flow:
    switch (this.ci) {
      case 'travis':
        return this._env.TRAVIS_REPO_SLUG;
      case 'jenkins':
        break;
      case 'circle':
        return `${this._env.CIRCLE_PROJECT_USERNAME}/${this._env.CIRCLE_PROJECT_REPONAME}`;
      case 'codeship':
        break;
      case 'drone':
        break;
      case 'semaphore':
        return this._env.SEMAPHORE_REPO_SLUG;
    }
    return null;
  }

  get pullRequestNumber() {
    if (this._env.PERCY_PULL_REQUEST) {
      return this._env.PERCY_PULL_REQUEST;
    }
    switch (this.ci) {
      case 'travis':
        return this._env.TRAVIS_PULL_REQUEST !== 'false' ? this._env.TRAVIS_PULL_REQUEST : null;
      case 'jenkins':
        return this._env.ghprbPullId;
      case 'circle':
        if (this._env.CI_PULL_REQUESTS && this._env.CI_PULL_REQUESTS !== '') {
          return this._env.CI_PULL_REQUESTS.split('/').slice(-1)[0];
        }
        break;
      case 'codeship':
        // Unfortunately, codeship always returns 'false' for CI_PULL_REQUEST. For now, return null.
        break;
      case 'drone':
        return this._env.CI_PULL_REQUEST;
      case 'semaphore':
        return this._env.PULL_REQUEST_NUMBER;
      case 'buildkite':
        return this._env.BUILDKITE_PULL_REQUEST !== 'false'
          ? this._env.BUILDKITE_PULL_REQUEST
          : null;
    }
    return null;
  }

  // A nonce which will be the same for all nodes of a parallel build, used to identify shards
  // of the same CI build. This is usually just the CI environment build ID.
  get parallelNonce() {
    if (this._env.PERCY_PARALLEL_NONCE) {
      return this._env.PERCY_PARALLEL_NONCE;
    }
    switch (this.ci) {
      case 'travis':
        return this._env.TRAVIS_BUILD_NUMBER;
      case 'jenkins':
        return this._env.BUILD_NUMBER;
      case 'circle':
        return this._env.CIRCLE_BUILD_NUM;
      case 'codeship':
        return this._env.CI_BUILD_NUMBER;
      case 'drone':
        return this._env.DRONE_BUILD_NUMBER;
      case 'semaphore':
        return `${this._env.SEMAPHORE_BRANCH_ID}/${this._env.SEMAPHORE_BUILD_NUMBER}`;
      case 'buildkite':
        return this._env.BUILDKITE_BUILD_ID;
    }
    return null;
  }

  get parallelTotalShards() {
    if (this._env.PERCY_PARALLEL_TOTAL) {
      return parseInt(this._env.PERCY_PARALLEL_TOTAL);
    }
    switch (this.ci) {
      case 'travis':
        // Support for https://github.com/ArturT/knapsack
        if (this._env.CI_NODE_TOTAL) {
          return parseInt(this._env.CI_NODE_TOTAL);
        }
        break;
      case 'jenkins':
        break;
      case 'circle':
        if (this._env.CIRCLE_NODE_TOTAL) {
          return parseInt(this._env.CIRCLE_NODE_TOTAL);
        }
        break;
      case 'codeship':
        if (this._env.CI_NODE_TOTAL) {
          return parseInt(this._env.CI_NODE_TOTAL);
        }
        break;
      case 'drone':
        break;
      case 'semaphore':
        if (this._env.SEMAPHORE_THREAD_COUNT) {
          return parseInt(this._env.SEMAPHORE_THREAD_COUNT);
        }
        break;
      case 'buildkite':
        if (this._env.BUILDKITE_PARALLEL_JOB_COUNT) {
          return parseInt(this._env.BUILDKITE_PARALLEL_JOB_COUNT);
        }
        break;
    }
    return null;
  }
}

module.exports = Environment;
