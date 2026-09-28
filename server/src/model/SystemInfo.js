const { Schema, model } = require("mongoose");

const SystemInfoSchema = new Schema({
  id: "system-admin",
  adminSetup: false,
});

const SystemInfo = model("SystemInfo", SystemInfoSchema);

module.exports = SystemInfo;
