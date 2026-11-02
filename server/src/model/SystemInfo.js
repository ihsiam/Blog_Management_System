const { Schema, model } = require("mongoose");

const SystemInfoSchema = new Schema({
  id: {
    type: String,
    default: "system-admin",
    unique: true,
  },
  adminSetup: {
    type: Boolean,
    default: false,
  },
});

const SystemInfo = model("SystemInfo", SystemInfoSchema);

module.exports = SystemInfo;
