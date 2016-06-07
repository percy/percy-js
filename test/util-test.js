let path = require('path');
let utils = require(path.join(__dirname, '..', 'utils'));
let assert = require('assert');

describe('sha256hash', function() {
  it('returns a SHA256 hash of the content', function() {
    let hash = utils.sha256hash('foo');
    assert.equal(hash.length, 64);
    assert.equal(hash, '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae');
  });
  it('correctly handles unicode', function() {
    let hash = utils.sha256hash('I ♡ JavaScript!');
    assert.equal(hash, '67e714147fe88f73b000da2f0447d16083801ba3ac9c31f607cf8cbaf994aa09');
  });
  it('correctly handles binary data', function() {
    let hash = utils.sha256hash('\x01\x02\x03');
    assert.equal(hash, '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81');
  });
});
describe('base64encode', function() {
  it('returns Base 64 encoded content', function() {
    assert.equal(utils.base64encode('foo'), 'Zm9v');
  });
  it('correctly handles unicode', function() {
    assert.equal(utils.base64encode('I ♡ \nJavaScript!'), 'SSDimaEgCkphdmFTY3JpcHQh');
  });
  it('correctly handles binary data', function() {
    assert.equal(utils.base64encode('\x01\x02\x03'), 'AQID');
  });
});
