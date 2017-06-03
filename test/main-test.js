let path = require('path');
let assert = require('assert');
let utils = require(path.join(__dirname, '..', 'utils'));
let PercyClient = require(path.join(__dirname, '..', 'main'));
let nock = require('nock');


describe('PercyClient', function() {
  let percyClient;

  beforeEach(function() {
    percyClient = new PercyClient({token: 'test-token'});
    nock.disableNetConnect();
  });
  afterEach(function() {
    nock.cleanAll();
  });

  describe('_httpGet', function() {
    it('sends a GET request', function(done) {
      let responseMock = function(url, requestBody) {
        // Verify some request states.
        assert.equal(this.req.headers['authorization'], 'Token token=test-token');
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
        assert.equal(this.req.headers['authorization'], `Token token=test-token`);
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
      let resources = [percyClient.makeResource({resourceUrl: '/foo%20bar', sha: 'fake-sha'})];
      // Make sure we're at least testing against a truthy value.
      assert.ok(percyClient.environment.branch);

      let expectedRequestData = {
        'data': {
          'type': 'builds',
          'attributes': {
            'branch': percyClient.environment.branch,
            'target-branch': percyClient.environment.targetBranch,
            'commit-sha': percyClient.environment.commitSha,
            'pull-request-number': percyClient.environment.pullRequestNumber,
            'parallel-nonce': null,
            'parallel-total-shards': null,
          },
          'relationships': {
            'resources': {
              'data': [
                {
                  'type': 'resources',
                  'id': 'fake-sha',
                  'attributes': {
                    'resource-url': '/foo%20bar',
                    'mimetype': null,
                    'is-root': null,
                  },
                }
              ],
            },
          },
        }
      };

      let responseMock = function(url, requestBody) {
        // Verify request data.
        assert.equal(requestBody, JSON.stringify(expectedRequestData));
        let responseBody = {foo: 123};
        return [201, responseBody];
      };
      nock('https://percy.io').post('/api/v1/repos/foo/bar/builds/').reply(201, responseMock);

      let request = percyClient.createBuild('foo/bar', {resources: resources});
      request.then((response) => {
        assert.equal(response.statusCode, 201);
        assert.deepEqual(response.body, {foo: 123});
        done();
      }).catch((err) => { done(err); });
    });
  });
  describe('makeResource', function() {
    it('returns a Resource object with defaults', function() {
      let resource = percyClient.makeResource({resourceUrl: '/foo', sha: 'fake-sha'});
      let expected = {
        'type': 'resources',
        'id': 'fake-sha',
        'attributes': {
          'resource-url': '/foo',
          'mimetype': null,
          'is-root': null,
        },
      };
      assert.deepEqual(resource.serialize(), expected);
    });
    it('handles arguments correctly', function() {
      let content = 'foo';
      let resource = percyClient.makeResource({
        resourceUrl: '/foo',
        isRoot: true,
        mimetype: 'text/plain',
        content: content,
        localPath: '/absolute/path/foo',
      });
      assert.equal(resource.resourceUrl, '/foo');
      assert.equal(resource.sha, utils.sha256hash(content));
      assert.equal(resource.content, content);
      assert.equal(resource.isRoot, true);
      assert.equal(resource.mimetype, 'text/plain');
      assert.equal(resource.localPath, '/absolute/path/foo');
      let expected = {
        'type': 'resources',
        'id': utils.sha256hash(content),
        'attributes': {
          'resource-url': '/foo',
          'mimetype': 'text/plain',
          'is-root': true,
        },
      };

      assert.deepEqual(resource.serialize(), expected);
    });
    it('throws an error if resourceUrl is not given', function() {
      assert.throws(() => {
        let resource = percyClient.makeResource({content: 'foo'});
      }, Error)
    });
    it('throws an error if resourceUrl contains a space', function() {
      assert.throws(() => {
        let resource = percyClient.makeResource({resourceUrl: 'foo bar'});
      }, Error)
    });
    it('throws an error if neither sha nor content is not given', function() {
      assert.throws(() => {
        let resource = percyClient.makeResource({resourceUrl: '/foo'});
      }, Error)
    });
  });
  describe('uploadResource', function() {
    it('uploads a resource', function(done) {
      let content = 'foo';
      let expectedRequestData = {
        'data': {
          'type': 'resources',
          'id': utils.sha256hash(content),
          'attributes': {
            'base64-content': utils.base64encode(content),
          }
        }
      };

      let responseMock = function(url, requestBody) {
        // Verify some request states.
        assert.equal(requestBody, JSON.stringify(expectedRequestData));
        let responseBody = {success: true};
        return [201, responseBody];
      };
      nock('https://percy.io').post('/api/v1/builds/123/resources/').reply(201, responseMock);

      let request = percyClient.uploadResource(123, content);
      request.then((response) => {
        assert.equal(response.statusCode, 201);
        assert.deepEqual(response.body, {success: true});
        done();
      }).catch((err) => { done(err); });
    });
  });
  describe('createSnapshot', function() {
    it('creates a snapshot', function(done) {
      let content = 'foo';
      let expectedRequestData = {
        'data': {
          'type': 'snapshots',
          'attributes': {
            'name': 'foo',
            'enable-javascript': true,
            'widths': [1000],
            'minimum-height': 100,
          },
          'relationships': {
            'resources': {
              'data': [
                {
                  'type': 'resources',
                  'id': utils.sha256hash(content),
                  'attributes': {
                    'resource-url': '/foo',
                    'mimetype': null,
                    'is-root': true,
                  },
                }
              ]
            }
          }
        }
      };

      let responseMock = function(url, requestBody) {
        // Verify some request states.
        assert.equal(requestBody, JSON.stringify(expectedRequestData));
        let responseBody = {success: true};
        return [201, responseBody];
      };
      nock('https://percy.io').post('/api/v1/builds/123/snapshots/').reply(201, responseMock);

      let options = {name: 'foo', enableJavaScript: true, widths: [1000], minimumHeight: 100}
      let resource = percyClient.makeResource({
        resourceUrl: '/foo',
        content: content,
        isRoot: true,
      });
      let resources = [resource];
      let request = percyClient.createSnapshot(123, resources, options);
      request.then((response) => {
        assert.equal(response.statusCode, 201);
        // This is not the actual API response, we just mocked it above.
        assert.deepEqual(response.body, {success: true});
        done();
      }).catch((err) => { done(err); });
    });
  });
  describe('finalizeSnapshot', function() {
    it('finalizes the snapshot', function(done) {
      let responseData = {success: true};
      nock('https://percy.io').post('/api/v1/snapshots/123/finalize').reply(201, responseData);

      let request = percyClient.finalizeSnapshot(123);
      request.then((response) => {
        assert.equal(response.statusCode, 201);
        assert.deepEqual(response.body, {success: true});
        done();
      }).catch((err) => { done(err); });
    });
  });
  describe('finalizeBuild', function() {
    it('finalizes the build', function(done) {
      let responseData = {success: true};
      nock('https://percy.io').post('/api/v1/builds/123/finalize').reply(201, responseData);

      let request = percyClient.finalizeBuild(123);
      request.then((response) => {
        assert.equal(response.statusCode, 201);
        assert.deepEqual(response.body, {success: true});
        done();
      }).catch((err) => { done(err); });
    });
  });
});
