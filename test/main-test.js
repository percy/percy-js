let path = require('path');
let assert = require('assert');
let utils = require(path.join(__dirname, '..', 'src', 'utils'));
let PercyClient = require(path.join(__dirname, '..', 'src', 'main'));
let nock = require('nock');
let fs = require('fs');

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
      let responseMock = function() {
        // Verify some request states.
        assert.equal(this.req.headers['authorization'], 'Token token=test-token');
        let responseBody = {success: true};
        return [200, responseBody];
      };
      nock('https://localhost')
        .get('/foo?bar')
        .reply(200, responseMock);
      let request = percyClient._httpGet('https://localhost/foo?bar');

      request
        .then(function(response) {
          assert.equal(response.statusCode, 200);
          assert.deepEqual(response.body, {success: true});
          done();
        })
        .catch(err => {
          done(err);
        });
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
      nock('https://localhost')
        .post('/foo')
        .reply(201, responseMock);
      let request = percyClient._httpPost('https://localhost/foo', requestData);

      request
        .then(response => {
          assert.equal(response.statusCode, 201);
          assert.deepEqual(response.body, {success: true});
          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('token', function() {
    it('returns the token', function() {
      assert.equal(percyClient.token, 'test-token');
    });
  });

  describe('createBuild', function() {
    it('returns build data', function(done) {
      let resources = [percyClient.makeResource({resourceUrl: '/foo%20bar', sha: 'fake-sha'})];
      // Make sure we're at least testing against a truthy value.
      assert.ok(percyClient.environment.branch);

      let expectedRequestData = {
        data: {
          type: 'builds',
          attributes: {
            branch: percyClient.environment.branch,
            'target-branch': percyClient.environment.targetBranch,
            'commit-sha': percyClient.environment.commitSha,
            'pull-request-number': percyClient.environment.pullRequestNumber,
            'parallel-nonce': null,
            'parallel-total-shards': null,
          },
          relationships: {
            resources: {
              data: [
                {
                  type: 'resources',
                  id: 'fake-sha',
                  attributes: {
                    'resource-url': '/foo%20bar',
                    mimetype: null,
                    'is-root': null,
                  },
                },
              ],
            },
          },
        },
      };

      let responseMock = function(url, requestBody) {
        // Verify request data.
        assert.equal(requestBody, JSON.stringify(expectedRequestData));
        let responseBody = {foo: 123};
        return [201, responseBody];
      };

      nock('https://percy.io')
        .post('/api/v1/projects/foo/bar/builds/')
        .reply(201, responseMock);
      let request = percyClient.createBuild('foo/bar', {
        resources: resources,
      });

      request
        .then(response => {
          assert.equal(response.statusCode, 201);
          assert.deepEqual(response.body, {foo: 123});
          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('getBuild', function() {
    it('returns the response body', function(done) {
      let responseMock = function(url, requestBody) {
        // Verify request data.
        assert.equal(requestBody, '');
        let responseBody = {foo: 123};
        return [201, responseBody];
      };

      nock('https://percy.io')
        .get('/api/v1/builds/100')
        .reply(201, responseMock);

      let request = percyClient.getBuild('100');

      request
        .then(response => {
          assert.equal(response.statusCode, 201);
          assert.deepEqual(response.body, {foo: 123});
          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('makeResource', function() {
    it('returns a Resource object with defaults', function() {
      let resource = percyClient.makeResource({
        resourceUrl: '/foo',
        sha: 'fake-sha',
      });
      let expected = {
        type: 'resources',
        id: 'fake-sha',
        attributes: {
          'resource-url': '/foo',
          mimetype: null,
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
        type: 'resources',
        id: utils.sha256hash(content),
        attributes: {
          'resource-url': '/foo',
          mimetype: 'text/plain',
          'is-root': true,
        },
      };

      assert.deepEqual(resource.serialize(), expected);
    });

    it('throws an error if resourceUrl is not given', function() {
      assert.throws(() => {
        percyClient.makeResource({content: 'foo'});
      }, Error);
    });

    it('throws an error if resourceUrl contains a space', function() {
      assert.throws(() => {
        percyClient.makeResource({resourceUrl: 'foo bar'});
      }, Error);
    });

    it('throws an error if neither sha nor content is not given', function() {
      assert.throws(() => {
        percyClient.makeResource({resourceUrl: '/foo'});
      }, Error);
    });
  });

  describe('uploadResource', function() {
    it('uploads a resource', function(done) {
      let content = 'foo';
      let expectedRequestData = {
        data: {
          type: 'resources',
          id: utils.sha256hash(content),
          attributes: {
            'base64-content': utils.base64encode(content),
          },
        },
      };
      let responseMock = function(url, requestBody) {
        // Verify some request states.
        assert.equal(requestBody, JSON.stringify(expectedRequestData));
        let responseBody = {success: true};
        return [201, responseBody];
      };

      nock('https://percy.io')
        .post('/api/v1/builds/123/resources/')
        .reply(201, responseMock);
      let request = percyClient.uploadResource(123, content);

      request
        .then(response => {
          assert.equal(response.statusCode, 201);
          assert.deepEqual(response.body, {success: true});
          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('uploadResources', function() {
    it('uploads resources with content', function(done) {
      const resources = [
        {
          content: 'foo',
        },
        {
          content: 'bar',
        },
      ];

      const expectedRequestData1 = {
        data: {
          type: 'resources',
          id: utils.sha256hash(resources[0].content),
          attributes: {
            'base64-content': utils.base64encode(resources[0].content),
          },
        },
      };
      const expectedRequestData2 = {
        data: {
          type: 'resources',
          id: utils.sha256hash(resources[1].content),
          attributes: {
            'base64-content': utils.base64encode(resources[1].content),
          },
        },
      };

      const responseMock = function(url, requestBody) {
        const requestJson = JSON.parse(requestBody);
        if (requestJson.data.id === expectedRequestData1.data.id) {
          assert.equal(requestBody, JSON.stringify(expectedRequestData1));
        } else if (requestJson.data.id === expectedRequestData2.data.id) {
          assert.equal(requestBody, JSON.stringify(expectedRequestData2));
        } else {
          assert.fail('Invalid resource uploaded');
        }
        const responseBody = {success: true};
        return [201, responseBody];
      };

      nock('https://percy.io')
        .post('/api/v1/builds/123/resources/')
        .times(2)
        .reply(201, responseMock);
      let request = percyClient.uploadResources(123, resources);

      request
        .then(() => {
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('uploads resources with local path', function(done) {
      const resources = [
        {
          localPath: path.join(__dirname, 'data', 'test-resource.css'),
        },
        {
          localPath: path.join(__dirname, 'data', 'test-resource.js'),
        },
      ];

      const cssContent = fs.readFileSync(resources[0].localPath);
      const expectedRequestData1 = {
        data: {
          type: 'resources',
          id: utils.sha256hash(cssContent),
          attributes: {
            'base64-content': utils.base64encode(cssContent),
          },
        },
      };

      const jsContent = fs.readFileSync(resources[1].localPath);
      const expectedRequestData2 = {
        data: {
          type: 'resources',
          id: utils.sha256hash(jsContent),
          attributes: {
            'base64-content': utils.base64encode(jsContent),
          },
        },
      };

      const responseMock = function(url, requestBody) {
        const requestJson = JSON.parse(requestBody);
        if (requestJson.data.id === expectedRequestData1.data.id) {
          assert.equal(requestBody, JSON.stringify(expectedRequestData1));
        } else if (requestJson.data.id === expectedRequestData2.data.id) {
          assert.equal(requestBody, JSON.stringify(expectedRequestData2));
        } else {
          assert.fail('Invalid resource uploaded');
        }
        const responseBody = {success: true};
        return [201, responseBody];
      };

      nock('https://percy.io')
        .post('/api/v1/builds/123/resources/')
        .times(2)
        .reply(201, responseMock);
      let request = percyClient.uploadResources(123, resources);

      request
        .then(() => {
          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('uploadMissingResources', function() {
    it('does nothing when there are no missing resources', function(done) {
      const response = {
        body: {
          data: {
            relationships: {
              'missing-resources': {
                data: [],
              },
            },
          },
        },
      };
      const resources = [
        {
          sha: '123',
        },
        {
          sha: '456',
        },
      ];

      const responseMock = function() {
        assert.fail('Should not be uploading any resources');
        return [500];
      };

      nock('https://percy.io')
        .post('/api/v1/builds/123/resources/')
        .reply(500, responseMock);
      const request = percyClient.uploadMissingResources(123, response, resources);

      request
        .then(() => {
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('uploads the missing resources', function(done) {
      const response = {
        body: {
          data: {
            relationships: {
              'missing-resources': {
                data: [
                  {
                    id: '456',
                  },
                ],
              },
            },
          },
        },
      };
      const resources = [
        {
          sha: '123',
          content: 'Foo',
        },
        {
          sha: '456',
          content: 'Bar',
        },
      ];

      const expectedRequestData = {
        data: {
          type: 'resources',
          id: utils.sha256hash(resources[1].content),
          attributes: {
            'base64-content': utils.base64encode(resources[1].content),
          },
        },
      };

      const responseMock = function(url, requestBody) {
        assert.equal(requestBody, JSON.stringify(expectedRequestData));
        const responseBody = {success: true};
        return [201, responseBody];
      };

      // Add a 520 to test retries
      nock('https://percy.io')
        .post('/api/v1/builds/123/resources/')
        .reply(502, {success: false});

      nock('https://percy.io')
        .post('/api/v1/builds/123/resources/')
        .reply(201, responseMock);
      const request = percyClient.uploadMissingResources(123, response, resources);

      request
        .then(() => {
          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('createSnapshot', function() {
    it('creates a snapshot', function(done) {
      let content = 'foo';
      let expectedRequestData = {
        data: {
          type: 'snapshots',
          attributes: {
            name: 'foo',
            'enable-javascript': true,
            widths: [1000],
            'minimum-height': 100,
          },
          relationships: {
            resources: {
              data: [
                {
                  type: 'resources',
                  id: utils.sha256hash(content),
                  attributes: {
                    'resource-url': '/foo',
                    mimetype: null,
                    'is-root': true,
                  },
                },
              ],
            },
          },
        },
      };

      let responseMock = function(url, requestBody) {
        // Verify some request states.
        assert.equal(requestBody, JSON.stringify(expectedRequestData));
        let responseBody = {success: true};
        return [201, responseBody];
      };
      nock('https://percy.io')
        .post('/api/v1/builds/123/snapshots/')
        .reply(201, responseMock);

      let options = {
        name: 'foo',
        enableJavaScript: true,
        widths: [1000],
        minimumHeight: 100,
      };
      let resource = percyClient.makeResource({
        resourceUrl: '/foo',
        content: content,
        isRoot: true,
      });
      let resources = [resource];
      let request = percyClient.createSnapshot(123, resources, options);

      request
        .then(response => {
          assert.equal(response.statusCode, 201);
          // This is not the actual API response, we just mocked it above.
          assert.deepEqual(response.body, {success: true});
          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('finalizeSnapshot', function() {
    it('finalizes the snapshot', function(done) {
      let responseData = {success: true};
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(201, responseData);

      let request = percyClient.finalizeSnapshot(123);

      request
        .then(response => {
          assert.equal(response.statusCode, 201);
          assert.deepEqual(response.body, {success: true});
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('finalizes the snapshot with 3 retries', function(done) {
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(502, {success: false});
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(503, {success: false});
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(520, {success: false});

      let responseData = {success: true};
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(201, responseData);

      let request = percyClient.finalizeSnapshot(123);

      request
        .then(response => {
          assert.equal(response.statusCode, 201);
          assert.deepEqual(response.body, {success: true});
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('finalize fails with status after 5 retries', function(done) {
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(502, {success: false});
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(502, {success: false});
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(502, {success: false});
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(502, {success: false});
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(502, {success: false});

      let request = percyClient.finalizeSnapshot(123);

      request.catch(err => {
        assert.equal(err.message, '502 - {"success":false}');
        assert.equal(err.statusCode, 502);
        assert.deepEqual(err.response.body, {success: false});
        done();
      });
    });

    it('finalize fails with 400 and returns error without retries', function(done) {
      nock('https://percy.io')
        .post('/api/v1/snapshots/123/finalize')
        .reply(400, {success: false});

      let request = percyClient.finalizeSnapshot(123);

      request.catch(err => {
        assert.equal(err.message, '400 - {"success":false}');
        assert.equal(err.statusCode, 400);
        assert.deepEqual(err.response.body, {success: false});
        done();
      });
    });
  });

  describe('finalizeBuild', function() {
    it('finalizes the build', function(done) {
      let responseData = {success: true};
      nock('https://percy.io')
        .post('/api/v1/builds/123/finalize')
        .reply(201, responseData);
      let request = percyClient.finalizeBuild(123);

      request
        .then(response => {
          assert.equal(response.statusCode, 201);
          assert.deepEqual(response.body, {success: true});
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('accepts allShards argument', function(done) {
      let responseData = {success: true};
      nock('https://percy.io')
        .post('/api/v1/builds/123/finalize?all-shards=true')
        .reply(201, responseData);
      let request = percyClient.finalizeBuild(123, {allShards: true});

      request
        .then(response => {
          assert.equal(response.statusCode, 201);
          assert.deepEqual(response.body, {success: true});
          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });
});
