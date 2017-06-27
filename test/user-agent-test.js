let path = require('path');
let UserAgent = require(path.join(__dirname, '..', 'user-agent'));
let PercyClient = require(path.join(__dirname, '..', 'main'));
let assert = require('assert');

import { version } from '../package.json';

describe('UserAgent', function() {
  let userAgent;
  let percyClient;

  afterEach(function() {
    userAgent = null;
  });

  context('no client or environment info', function() {
    beforeEach(function() {
      percyClient = new PercyClient();
      userAgent = new UserAgent(percyClient);
    });

    describe('userAgent', function() {
      it('is correct', function() {
        assert.strictEqual(
          userAgent.userAgent(),
          `Percy/v1 percy-js/${version} (node/${process.version})`
        );
      });
    });
  });

  context('client and environment info set from a higher level client', function() {
    let clientInfo = 'react-percy-storybook/1.0.0'
    let environmentInfo = 'react/15.6.1'

    beforeEach(function() {
      percyClient = new PercyClient({
        client_info: clientInfo,
        environment_info: 'react/15.6.1',
      });

      userAgent = new UserAgent(percyClient);
    });

    describe('userAgent', function() {
      it('has the correct client and environment info', function() {
        assert.strictEqual(
          userAgent.userAgent(),
          `Percy/v1 ${clientInfo} percy-js/${version} (${environmentInfo}; node/${process.version})`
        );
      });
    });
  });
});
