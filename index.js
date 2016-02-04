class PercyClient {
  constructor(token) {
    this._token = token;
  }

  get token() {
    return this._token;
  }

  set token(value) {
    this._token = value;
  }
}

module.exports = PercyClient;