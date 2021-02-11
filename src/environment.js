const utils = require('./utils');

const GIT_COMMIT_FORMAT = [
  'COMMIT_SHA:%H',
  'AUTHOR_NAME:%an',
  'AUTHOR_EMAIL:%ae',
  'COMMITTER_NAME:%cn',
  'COMMITTER_EMAIL:%ce',
  'COMMITTED_DATE:%ai',
  // Note: order is important, this must come last because the regex is a multiline match.
  'COMMIT_MESSAGE:%B',
].join('%n'); // git show format uses %n for newlines.

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
      return 'jenkins-prb';
    } else if (this._env.JENKINS_URL) {
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
    } else if (this._env.HEROKU_TEST_RUN_ID) {
      return 'heroku';
    } else if (this._env.GITLAB_CI == 'true') {
      return 'gitlab';
    } else if (this._env.TF_BUILD == 'True') {
      return 'azure';
    } else if (this._env.APPVEYOR == 'True' || this._env.APPVEYOR == 'true') {
      return 'appveyor';
    } else if (this._env.PROBO_ENVIRONMENT == 'TRUE') {
      return 'probo';
    } else if (this._env.BITBUCKET_BUILD_NUMBER) {
      return 'bitbucket';
    } else if (this._env.GITHUB_ACTIONS == 'true') {
      return 'github';
    } else if (this._env.NETLIFY == 'true') {
      return 'netlify';
    } else if (this._env.CI) {
      // this should always be the last branch
      return 'CI/unknown';
    }

    return null;
  }

  get ciVersion() {
    switch (this.ci) {
      case 'github':
        return `github/${this._env.PERCY_GITHUB_ACTION || 'unknown'}`;
      case 'gitlab':
        return `gitlab/${this._env.CI_SERVER_VERSION}`;
      case 'semaphore':
        return this._env.SEMAPHORE_GIT_SHA ? 'semaphore/2.0' : 'semaphore';
    }
    return this.ci;
  }

  gitExec(args) {
    const child_process = require('child_process');
    try {
      let result = child_process.spawnSync('git', args);
      if (result.status == 0) {
        return result.stdout.toString().trim();
      } else {
        return '';
      }
    } catch (error) {
      return '';
    }
  }

  rawCommitData(commitSha) {
    // Make sure commitSha is only alphanumeric characters and ^ to prevent command injection.
    if (commitSha.length > 100 || !commitSha.match(/^[0-9a-zA-Z^]+$/)) {
      return '';
    }

    const args = ['show', commitSha, '--quiet', `--format="${GIT_COMMIT_FORMAT}"`];
    return this.gitExec(args);
  }

  // If not running in a git repo, allow undefined for certain commit attributes.
  parse(formattedCommitData, regex) {
    return ((formattedCommitData && formattedCommitData.match(regex)) || [])[1];
  }

  get commitData() {
    // Read the result from environment data
    let result = {
      branch: this.branch,
      sha: this.commitSha,

      // These GIT_ environment vars are from the Jenkins Git Plugin, but could be
      // used generically. This behavior may change in the future.
      authorName: this._env['GIT_AUTHOR_NAME'],
      authorEmail: this._env['GIT_AUTHOR_EMAIL'],
      committerName: this._env['GIT_COMMITTER_NAME'],
      committerEmail: this._env['GIT_COMMITTER_EMAIL'],
    };

    // Try and get more meta-data from git
    let formattedCommitData = '';
    if (this.commitSha) {
      formattedCommitData = this.rawCommitData(this.commitSha);
    }
    if (!formattedCommitData) {
      formattedCommitData = this.rawCommitData('HEAD');
    }
    if (!formattedCommitData) {
      return result;
    }

    // If this.commitSha didn't provide a sha, use the one from the commit
    if (!result.sha) {
      result.sha = this.parse(formattedCommitData, /COMMIT_SHA:(.*)/);
    }

    result.message = this.parse(formattedCommitData, /COMMIT_MESSAGE:(.*)/m);
    result.committedAt = this.parse(formattedCommitData, /COMMITTED_DATE:(.*)/);
    result.authorName = this.parse(formattedCommitData, /AUTHOR_NAME:(.*)/);
    result.authorEmail = this.parse(formattedCommitData, /AUTHOR_EMAIL:(.*)/);
    result.committerName = this.parse(formattedCommitData, /COMMITTER_NAME:(.*)/);
    result.committerEmail = this.parse(formattedCommitData, /COMMITTER_EMAIL:(.*)/);

    return result;
  }

  get jenkinsMergeCommitBuild() {
    let formattedCommitData = this.rawCommitData('HEAD');

    if (!formattedCommitData) {
      return false;
    }

    let authorName = this.parse(formattedCommitData, /AUTHOR_NAME:(.*)/);
    let authorEmail = this.parse(formattedCommitData, /AUTHOR_EMAIL:(.*)/);
    let message = this.parse(formattedCommitData, /COMMIT_MESSAGE:(.*)/m);

    if (authorName === 'Jenkins' && authorEmail === 'nobody@nowhere') {
      // Example merge message: Merge commit 'ec4d24c3d22f3c95e34af95c1fda2d462396d885' into HEAD
      if (message.substring(0, 13) === 'Merge commit ' && message.substring(55) === ' into HEAD') {
        return true;
      }
    }

    return false;
  }

  get secondToLastCommitSHA() {
    let formattedCommitData = this.rawCommitData('HEAD^');

    if (!formattedCommitData) {
      return null;
    }

    return this.parse(formattedCommitData, /COMMIT_SHA:(.*)/);
  }

  get commitSha() {
    if (this._env.PERCY_COMMIT) {
      return this._env.PERCY_COMMIT;
    }
    switch (this.ci) {
      case 'travis':
        return this._env.TRAVIS_COMMIT;
      case 'jenkins-prb':
        // Pull Request Builder Plugin OR Git Plugin.
        return this._env.ghprbActualCommit || this._env.GIT_COMMIT;
      case 'jenkins':
        if (this.jenkinsMergeCommitBuild) {
          return this.secondToLastCommitSHA;
        }
        return this._env.GIT_COMMIT;
      case 'circle':
        return this._env.CIRCLE_SHA1;
      case 'codeship':
        return this._env.CI_COMMIT_ID;
      case 'drone':
        return this._env.DRONE_COMMIT;
      case 'semaphore':
        return this._env.REVISION || this._env.SEMAPHORE_GIT_PR_SHA || this._env.SEMAPHORE_GIT_SHA;
      case 'buildkite': {
        let commitSha = this._env.BUILDKITE_COMMIT;
        // Buildkite mixes SHAs and non-SHAs in BUILDKITE_COMMIT, so we return null if non-SHA.
        return commitSha !== 'HEAD' ? this._env.BUILDKITE_COMMIT : null;
      }
      case 'heroku':
        return this._env.HEROKU_TEST_RUN_COMMIT_VERSION;
      case 'gitlab':
        return this._env.CI_COMMIT_SHA;
      case 'azure':
        return this._env.SYSTEM_PULLREQUEST_SOURCECOMMITID || this._env.BUILD_SOURCEVERSION;
      case 'appveyor':
        return this._env.APPVEYOR_PULL_REQUEST_HEAD_COMMIT || this._env.APPVEYOR_REPO_COMMIT;
      case 'probo':
      case 'netlify':
        return this._env.COMMIT_REF;
      case 'bitbucket':
        return this._env.BITBUCKET_COMMIT;
      case 'github':
        return this._env.GITHUB_SHA;
    }

    return null;
  }

  get targetCommitSha() {
    return this._env.PERCY_TARGET_COMMIT || null;
  }

  get partialBuild() {
    let partial = this._env.PERCY_PARTIAL_BUILD;
    return !!partial && partial !== '0';
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
      case 'jenkins-prb':
        result = this._env.ghprbSourceBranch;
        break;
      case 'jenkins':
        result = this._env.CHANGE_BRANCH || this._env.GIT_BRANCH;
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
        result =
          this._env.BRANCH_NAME ||
          this._env.SEMAPHORE_GIT_PR_BRANCH ||
          this._env.SEMAPHORE_GIT_BRANCH;
        break;
      case 'buildkite':
        result = this._env.BUILDKITE_BRANCH;
        break;
      case 'heroku':
        result = this._env.HEROKU_TEST_RUN_BRANCH;
        break;
      case 'gitlab':
        result = this._env.CI_COMMIT_REF_NAME;
        break;
      case 'azure':
        result = this._env.SYSTEM_PULLREQUEST_SOURCEBRANCH || this._env.BUILD_SOURCEBRANCHNAME;
        break;
      case 'appveyor':
        result = this._env.APPVEYOR_PULL_REQUEST_HEAD_REPO_BRANCH || this._env.APPVEYOR_REPO_BRANCH;
        break;
      case 'probo':
        result = this._env.BRANCH_NAME;
        break;
      case 'bitbucket':
        result = this._env.BITBUCKET_BRANCH;
        break;
      case 'github':
        if (this._env.GITHUB_REF && this._env.GITHUB_REF.match(/^refs\//)) {
          result = this._env.GITHUB_REF.replace(/^refs\/\w+?\//, '');
        } else {
          result = this._env.GITHUB_REF;
        }
        break;
      case 'netlify':
        result = this._env.HEAD;
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
    return this.gitExec(['rev-parse', '--abbrev-ref', 'HEAD']);
  }

  get targetBranch() {
    return this._env.PERCY_TARGET_BRANCH || null;
  }

  get pullRequestNumber() {
    if (this._env.PERCY_PULL_REQUEST) {
      return this._env.PERCY_PULL_REQUEST;
    }
    switch (this.ci) {
      case 'travis':
        return this._env.TRAVIS_PULL_REQUEST !== 'false' ? this._env.TRAVIS_PULL_REQUEST : null;
      case 'jenkins-prb':
        return this._env.ghprbPullId;
      case 'jenkins':
        return this._env.CHANGE_ID || null;
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
        return this._env.PULL_REQUEST_NUMBER || this._env.SEMAPHORE_GIT_PR_NUMBER || null;
      case 'buildkite':
        return this._env.BUILDKITE_PULL_REQUEST !== 'false'
          ? this._env.BUILDKITE_PULL_REQUEST
          : null;
      case 'gitlab':
        return this._env.CI_MERGE_REQUEST_IID || null;
      case 'azure':
        return this._env.SYSTEM_PULLREQUEST_PULLREQUESTID
          || this._env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER || null;
      case 'appveyor':
        return this._env.APPVEYOR_PULL_REQUEST_NUMBER || null;
      case 'probo':
        if (this._env.PULL_REQUEST_LINK && this._env.PULL_REQUEST_LINK !== '') {
          return this._env.PULL_REQUEST_LINK.split('/').slice(-1)[0];
        }
        break;
      case 'bitbucket':
        return this._env.BITBUCKET_PR_ID || null;
      case 'netlify':
        if (this._env.PULL_REQUEST == 'true') {
          return this._env.REVIEW_ID;
        }
        break;
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
      case 'jenkins-prb':
        return this._env.BUILD_NUMBER;
      case 'jenkins':
        if (this._env.BUILD_TAG) {
          return utils.reverseString(this._env.BUILD_TAG).substring(0, 60);
        }
        break;
      case 'circle':
        return this._env.CIRCLE_WORKFLOW_ID || this._env.CIRCLE_BUILD_NUM;
      case 'codeship':
        return this._env.CI_BUILD_NUMBER || this._env.CI_BUILD_ID;
      case 'drone':
        return this._env.DRONE_BUILD_NUMBER;
      case 'semaphore':
        return (
          this._env.SEMAPHORE_WORKFLOW_ID ||
          `${this._env.SEMAPHORE_BRANCH_ID}/${this._env.SEMAPHORE_BUILD_NUMBER}`
        );
      case 'buildkite':
        return this._env.BUILDKITE_BUILD_ID;
      case 'heroku':
        return this._env.HEROKU_TEST_RUN_ID;
      case 'gitlab':
        return this._env.CI_PIPELINE_ID;
      case 'azure':
        return this._env.BUILD_BUILDID;
      case 'appveyor':
        return this._env.APPVEYOR_BUILD_ID;
      case 'probo':
        return this._env.BUILD_ID;
      case 'bitbucket':
        return this._env.BITBUCKET_BUILD_NUMBER;
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
      case 'jenkins-prb':
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
      case 'heroku':
        if (this._env.CI_NODE_TOTAL) {
          return parseInt(this._env.CI_NODE_TOTAL);
        }
        break;
      case 'azure':
        // SYSTEM_TOTALJOBSINPHASE is set for parallel builds and non-parallel matrix builds, so
        // check build strategy is parallel by ensuring SYSTEM_PARALLELEXECUTIONTYPE == MultiMachine
        if (
          this._env.SYSTEM_PARALLELEXECUTIONTYPE == 'MultiMachine' &&
          this._env.SYSTEM_TOTALJOBSINPHASE
        ) {
          return parseInt(this._env.SYSTEM_TOTALJOBSINPHASE);
        }
        break;
    }
    return null;
  }
}

module.exports = Environment;
