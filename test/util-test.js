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
    let hash = utils.sha256hash('\x01\x02\x99');
    assert.equal(hash, '46e9b4475a55f86f185cc978fdaef90d4a2ef6ba66d77cecb8763a60999a41c3');
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
    assert.equal(utils.base64encode('\x01\x02\x99'), 'AQLCmQ==');
  });
});
