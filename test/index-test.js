let path = require('path');
let assert = require('assert');
let PercyClient = require(path.join(__dirname, '..', 'index'));

describe('PercyClient', () => {
  let percyClient;
  beforeEach(() => {
    percyClient = new PercyClient('test-token');
  });

  describe('#token', () => {
    it('returns the token', () => {
      assert.equal(percyClient.token, 'test-token');
    });
  });
});
