import {version} from '../package.json';

class UserAgent {
  constructor(client) {
    if (!client) {
      throw new Error('"client" arg is required to create a UserAgent.');
    }
    this._client = client;
  }

  toString() {
    let client = [
      `Percy/${this._apiVersion()}`,
      this._client._specificClientInfo,
      this._client._genericClientInfo,
      `percy-js/${version}`,
    ]
      .filter(el => el != null)
      .join(' ');

    let environment = [
      this._client._specificEnvironmentInfo,
      this._client._genericEnvironmentInfo,
      `node/${this._nodeVersion()}`,
      this._client.environment.ciVersion,
    ]
      .filter(el => el != null)
      .join('; ');

    return `${client} (${environment})`;
  }

  _nodeVersion() {
    return process.version;
  }

  _apiVersion() {
    return /\w+$/.exec(this._client.apiUrl);
  }
}

module.exports = UserAgent;
