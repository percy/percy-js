let path = require('path');
let UserAgent = require(path.join(__dirname, '..', 'src', 'user-agent'));
let PercyClient = require(path.join(__dirname, '..', 'src', 'main'));
let Environment = require(path.join(__dirname, '..', 'src', 'environment'));
let assert = require('assert');

import {version} from '../package.json';

// Regex is used to check matching in this file so we can have the tests pass both locally
// and remotely (when `travis` is included in the environment string)
describe('UserAgent', function() {
  let userAgent;
  let percyClient;

  afterEach(function() {
    userAgent = null;
    percyClient = null;
  });

  context('no client or environment info', function() {
    beforeEach(function() {
      percyClient = new PercyClient();
      userAgent = new UserAgent(percyClient);
    });

    describe('userAgent', function() {
      it('is correct', function() {
        let regex = new RegExp(
          `Percy/v1 percy-js/${version} ` +
            `\\(node/${process.version}(; ${percyClient.environment.ciVersion})?\\)`,
        );

        assert(
          userAgent.toString().match(regex),
          `"${userAgent.toString()}" user agent does not match ${regex}`,
        );
      });
    });
  });

  context('with a gitlab version present', function() {
    let environment;

    beforeEach(function() {
      environment = new Environment({
        GITLAB_CI: 'true',
        CI_SERVER_VERSION: '8.14.3-ee',
      });
      percyClient = new PercyClient({environment: environment});
      userAgent = new UserAgent(percyClient);
    });

    afterEach(function() {
      environment = null;
    });

    describe('userAgent', function() {
      it('is correct', function() {
        let regex = new RegExp(
          `Percy/v1 percy-js/${version} ` + `\\(node/${process.version}; gitlab/8.14.3-ee\\)`,
        );

        assert(
          userAgent.toString().match(regex),
          `"${userAgent.toString()}" user agent does not match ${regex}`,
        );
      });
    });
  });

  context('client and environment info set from a higher level client', function() {
    let clientInfo = 'react-percy-storybook/1.0.0';
    let environmentInfo = 'react/15.6.1';

    beforeEach(function() {
      percyClient = new PercyClient({
        clientInfo: clientInfo,
        environmentInfo: environmentInfo,
      });
      userAgent = new UserAgent(percyClient);
    });

    describe('userAgent', function() {
      it('has the correct client and environment info', function() {
        let regex = new RegExp(
          `Percy/v1 ${clientInfo} percy-js/${version} ` +
            `\\(${environmentInfo}; node/${process.version}` +
            `(; ${percyClient.environment.ciVersion})?\\)`,
        );

        assert(
          userAgent.toString().match(regex),
          `"${userAgent.toString()}" user agent does not match ${regex}`,
        );
      });
    });
  });

  context('sdkClient and sdkEnvironment info sent from percy-agent', function() {
    const clientInfo = 'react-percy-storybook/1.0.0';
    const environmentInfo = 'react/15.6.1';
    const sdkClientInfo = '@percy/cypress/0.2.0';
    const sdkEnvironmentInfo = 'cypress/3.1.0';

    describe('userAgent', function() {
      beforeEach(function() {
        percyClient = new PercyClient({
          clientInfo: clientInfo,
          environmentInfo: environmentInfo,
        });
        percyClient._sdkClientInfo = sdkClientInfo;
        percyClient._sdkEnvironmentInfo = sdkEnvironmentInfo;
        userAgent = new UserAgent(percyClient);
      });
      it('has the correct client and environment info', function() {
        let regex = new RegExp(
          `Percy/v1 ${sdkClientInfo} ${clientInfo} percy-js/${version} ` +
            `\\(${sdkEnvironmentInfo}; ${environmentInfo}; node/${process.version}` +
            `(; ${percyClient.environment.ciVersion})?\\)`,
        );

        assert(
          userAgent.toString().match(regex),
          `"${userAgent.toString()}" user agent does not match ${regex}`,
        );
      });
    });
  });
});
