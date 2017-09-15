const crypto = require("crypto");
const base64 = require("base64-js");

module.exports = {
  sha256hash(content) {
    return crypto
      .createHash("sha256")
      .update(content, "utf8")
      .digest("hex");
  },

  base64encode(content) {
    return base64.fromByteArray(new Buffer(content));
  },

  getMissingResources(response) {
    return (
      (response &&
        response.body &&
        response.body.data &&
        response.body.data.relationships &&
        response.body.data.relationships["missing-resources"] &&
        response.body.data.relationships["missing-resources"].data) ||
      []
    );
  }
};
