const fs = require("fs/promises");
const path = require("path");

class DBConnection {
  constructor(url) {
    this.db = null;
    this.db_url = url;
  }

  async connect() {
    const dbstr = await fs.readFile(this.db_url, { encoding: "utf-8" });
    this.db = JSON.parse(dbstr);
  }

  async write() {
    if (this.db) {
      await fs.writeFile(this.db_url, JSON.stringify(this.db));
    }
  }
}

const dbConnection = new DBConnection(path.resolve(process.env.DB_URL));

module.exports = dbConnection;
