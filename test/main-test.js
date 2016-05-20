let path = require('path');
let assert = require('assert');
let PercyClient = require(path.join(__dirname, '..', 'main'));
let nock = require('nock');


describe('PercyClient', function() {
  let percyClient;

  beforeEach(function() {
    percyClient = new PercyClient('test-token');
    nock.disableNetConnect();
  });

  describe('_httpGet', function() {
    it('sends a GET request', function(done) {
      let responseMock = function(url, requestBody) {
        // Verify some request states.
        assert.equal(this.req.headers['content-type'], 'application/vnd.api+json');
        assert.equal(this.req.headers['authentication'], 'Token token=test-token');
        let responseBody = {success: true};
        return [200, responseBody];
      };
      nock('https://localhost').get('/foo?bar').reply(200, responseMock);

      let request = percyClient._httpGet('https://localhost/foo?bar');
      request.then(function(response) {
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, {success: true});
        done();
      }).catch((err) => { done(err); });
    });
  });
  describe('_httpPost', function() {
    it('sends a POST request', function(done) {
      let requestData = {foo: 123};

      let responseMock = function(url, requestBody) {
        // Verify some request states.
        assert.equal(this.req.headers['content-type'], 'application/vnd.api+json');
        assert.equal(this.req.headers['authentication'], `Token token=test-token`);
        assert.equal(requestBody, JSON.stringify(requestData));
        let responseBody = {success: true};
        return [201, responseBody];
      };
      nock('https://localhost').post('/foo').reply(201, responseMock);

      let request = percyClient._httpPost('https://localhost/foo', requestData);
      request.then((response) => {
        assert.equal(response.statusCode, 201);
        assert.deepEqual(response.body, {success: true});
        done();
      }).catch((err) => { done(err); });
    });
  });
  describe('token', function() {
    it('returns the token', function() {
      assert.equal(percyClient.token, 'test-token');
    });
  });
  describe('createBuild', function() {
    it('returns build data', function(done) {
      let responseData = {foo: 123};
      nock('https://percy.io').post('/api/v1/repos/foo/bar/builds/').reply(201, responseData);

      let request = percyClient.createBuild('foo/bar');
      request.then((response) => {
        assert.equal(response.statusCode, 201);
        assert.deepEqual(response.body, {foo: 123});
        done();
      }).catch((err) => { done(err); });
    });
  });
});
