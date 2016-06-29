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
    } else if (this._env.JENKINS_URL && this._env.ghprbPullId) { // Pull Request Builder plugin.
      return 'jenkins';
    } else if (this._env.CIRCLECI) {
      return 'circle';
    } else if (this._env.CI_NAME && this._env.CI_NAME == 'codeship') {
      return 'codeship';
    } else if (this._env.DRONE == 'true') {
      return 'drone';
    } else if (this._env.SEMAPHORE == 'true') {
      return 'semaphore';
    }
    return null;
  }

  get commitSha() {
    if (this._env.PERCY_COMMIT) {
      return this._env.PERCY_COMMIT;
    }
    switch(this.ci) {
      case 'travis':
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
    }
    return null;
  }

  get branch() {
    if (this._env.PERCY_BRANCH) {
      return this._env.PERCY_BRANCH;
    }
    switch(this.ci) {
      case 'travis':
        // Note: this is very unfortunately necessary because Travis doesn't expose the head branch,
        // only the targeted branch in TRAVIS_BRANCH and no way to get the actual head PR branch.
        // We create a fake branch name so that Percy doesn't mistake this PR as a new master build.
        // https://github.com/travis-ci/travis-ci/issues/1633#issuecomment-194749671
        if (this.pullRequestNumber && this._env.TRAVIS_BRANCH == 'master') {
          return `github-pr-${this.pullRequestNumber}`
        }
        return this._env.TRAVIS_BRANCH;
      case 'jenkins':
        return this._env.ghprbTargetBranch;
      case 'circle':
        return this._env.CIRCLE_BRANCH;
      case 'codeship':
        return this._env.CI_BRANCH;
      case 'drone':
        return this._env.DRONE_BRANCH;
      case 'semaphore':
        return this._env.BRANCH_NAME;
    }
    // Not in a git repo? Assume that the branch is master.
    return 'master';
  }

  get targetBranch() {
    if (this._env.PERCY_TARGET_BRANCH) {
      return this._env.PERCY_TARGET_BRANCH;
    }
    return null;
  }

  get repo() {
    if (this._env.PERCY_REPO_SLUG || this._env.PERCY_PROJECT) {
      return this._env.PERCY_REPO_SLUG || this._env.PERCY_PROJECT;
    }
    switch(this.ci) {
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
    switch(this.ci) {
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
    }
    return null;
  }

  // A nonce which will be the same for all nodes of a parallel build, used to identify shards
  // of the same CI build. This is usually just the CI environment build ID.
  get parallelNonce() {
    if (this._env.PERCY_PARALLEL_NONCE) {
      return this._env.PERCY_PARALLEL_NONCE;
    }
    switch(this.ci) {
      case 'travis':
        return this._env.TRAVIS_BUILD_NUMBER;
      case 'jenkins':
        return this._env.ghprbPullId;
      case 'circle':
        return this._env.CIRCLE_BUILD_NUM;
      case 'codeship':
        return this._env.CI_BUILD_NUMBER;
      case 'drone':
        return this._env.DRONE_BUILD_NUMBER;
      case 'semaphore':
        return this._env.SEMAPHORE_BUILD_NUMBER;
    }
    return null;
  }

  get parallelTotalShards() {
    if (this._env.PERCY_PARALLEL_TOTAL) {
      return parseInt(this._env.PERCY_PARALLEL_TOTAL);
    }
    switch(this.ci) {
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
        break;
      case 'drone':
        break;
      case 'semaphore':
        if (this._env.SEMAPHORE_THREAD_COUNT) {
          return parseInt(this._env.SEMAPHORE_THREAD_COUNT);
        }
        break;
    }
    return null;
  }
}

module.exports = Environment;