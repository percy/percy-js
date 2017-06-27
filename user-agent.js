import { version } from './package.json';

class UserAgent {
  constructor(client) {
    if (!client) {
      throw new Error('"client" arg is required to create a UserAgent.');
    }
    this._client = client;
  }

  user_agent() {
    let client = [
      `Percy/${this._api_version()}`,
      this._client._client_info,
      `percy-js/${version}`,
    ].filter((el) => el != null).join(' ')

    let environment = [
      this._client._environment_info,
      `node/${this._node_version()}`,
      this._client.environment.ci,
    ].filter((el) => el != null).join('; ')

    return `${client} (${environment})`
  }

  _node_version() {
    return process.version;
  }

  _api_version() {
    return /\w+$/.exec(this._client.apiUrl);
  }
}

module.exports = UserAgent;
