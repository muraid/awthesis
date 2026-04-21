const storage = require("Storage");

// ---------------- SETTINGS ----------------

let settings = {
  sensors: ["steps", "accel", "hr", "temp"], // default
  interval: 10, // seconds
  emaEnabled: false,
  emaInterval: 3600, // seconds (1 hour default)
  rawMode: false,
  ramSize: 50
};

const config = {
  filename: "collectedData.bin",
  bytesPerStepCount: 1,
  appendPos: 0
};

// File sizes
const RAW_FILE_LEN = 60000;
const AGG_FILE_LEN = 20000;

// Load settings from storage
try {
  let savedSettings = storage.readJSON("awapp.settings.json");
  if (savedSettings) {
    settings = Object.assign(settings, savedSettings);
  }
} catch (e) {
}

exports.settings = settings;
exports.config = config;
exports.RAW_FILE_LEN = RAW_FILE_LEN;
exports.AGG_FILE_LEN = AGG_FILE_LEN;

