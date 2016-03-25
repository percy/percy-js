let path = require('path');
let assert = require('assert');
let PercyClient = require(path.join(__dirname, '..', 'index'));
let fetchMock = require('fetch-mock');

describe('PercyClient', function() {
  let percyClient;

  beforeEach(function() {
    percyClient = new PercyClient('test-token');

    // Inject a new fetch dependency that can mock HTTP requests.
    percyClient._fetch = fetchMock.fetchMock;
  });
  afterEach(function() {
    fetchMock.restore();
  });

  describe('_http_get', function() {
    it('sends a GET request', function(done) {
      let responseMock = function(url, options) {
        // Verify some request states.
        assert.equal(options.headers['Content-Type'], 'application/vnd.api+json');
        assert.equal(options.headers['Authentication'], `Token token=test-token`);
        return {
          status: 200,
          body: {success: true},
          headers: {
            'Content-Type': 'application/json',
          }
        };
      };
      fetchMock.mock('https://localhost/foo?bar', 'GET', responseMock);

      let request = percyClient._http_get('https://localhost/foo?bar');
      request.then((response) => {
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Type'), 'application/json');

        response.json().then((data) => {
          assert.deepEqual(data, {success: true});
          done();
        }).catch((err) => { done(err); });
      }).catch((err) => { done(err); });;
    });
  });
  describe('_http_post', function() {
    it('sends a POST request', function(done) {
      let requestData = {foo: 123};

      let responseMock = function(url, options) {
        // Verify some request states.
        assert.equal(options.headers['Content-Type'], 'application/vnd.api+json');
        assert.equal(options.headers['Authentication'], `Token token=test-token`);
        assert.equal(options.body, JSON.stringify(requestData));
        return {
          status: 201,
          body: {success: true},
          headers: {
            'Content-Type': 'application/json',
          }
        };
      };
      fetchMock.mock('https://localhost/foo', 'POST', responseMock);

      let request = percyClient._http_post('https://localhost/foo', requestData);

      request.then((response) => {
        assert.equal(response.status, 201);
        assert.equal(response.headers.get('Content-Type'), 'application/json');

        response.json().then((json) => {
          assert.deepEqual(json, {success: true});
          done();
        }).catch((err) => { done(err); });
      }).catch((err) => { done(err); });;
    });
  });
  describe('token', function() {
    it('returns the token', function() {
      assert.equal(percyClient.token, 'test-token');
    });
  });
  describe('createBuild', function() {
    it('returns build data', function() {
      let responseData = {
        status: 201,
        body: {foo: 123},
      };
      fetchMock.mock('https://percy.io/api/v1/repos/foo/bar/builds/', 'POST', responseData);

      let request = percyClient.createBuild('foo/bar');
      return request.then((response) => {
        assert.equal(response.status, 201);
        return response.json();
      }).then((data) => {
        assert.deepEqual(data, {foo: 123});
      });
    });
  });
});
