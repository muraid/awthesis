// ---------------- IMPORTS ----------------
const sensors = require("sensors.js");
const logging = require("logging.js");
const tests = require("tests.js");
const { settings } = require("settings.js");

// ---------------- SEND FUNCTION ----------------
function send(line) {
  Bluetooth.println(line);
}

// ---------------- INIT BLE ----------------
function initBLE() {

  // Set streaming callback so sensors can send data
  sensors.setStreamCallback(send);

  Bluetooth.on("data", function(d) {
    d.split("\n").forEach(cmd => {
      cmd = cmd.trim();
      if (!cmd) return;

      send("DEBUG: GOT CMD " + cmd);

      // ---- SENSOR COMMANDS ----
      if (cmd === "HR_ON") sensors.startHRM();
      if (cmd === "HR_OFF") sensors.stopHRM();

      if (cmd === "ACC_ON") sensors.startAccel();
      if (cmd === "ACC_OFF") sensors.stopAccel();

      if (cmd === "STEPS_ON") sensors.startSteps();
      if (cmd === "STEPS_OFF") sensors.stopSteps();

      if (cmd === "MAG_ON") sensors.startMag();
      if (cmd === "MAG_OFF") sensors.stopMag();

      if (cmd === "PRESSURE_ON") sensors.startPressure();
      if (cmd === "PRESSURE_OFF") sensors.stopPressure();

      if (cmd === "TEMP_ON") sensors.startTemp();
      if (cmd === "TEMP_OFF") sensors.stopTemp();

      if (cmd === "GPS_ON") sensors.startGps();
      if (cmd === "GPS_OFF") sensors.stopGps();

      // ---- START STREAMING ----
      if (cmd === "START") {
        sensors.startStreaming();
        send("DEBUG: STREAMING STARTED");
      }

      // ---- STOP STREAMING ----
      if (cmd === "STOP") {
        sensors.stopStreaming();
        send("STOPPED");
      }

      // ---- LOGGING COMMANDS ----
      if (cmd === "LOG_START") {
        logging.startCollection();
        send("LOGGING STARTED");
      }

      if (cmd === "LOG_STOP") {
        logging.stopCollection();
        send("LOGGING STOPPED");
      }

      // ---- TEST COMMANDS ----
      if (cmd === "6MWT_START") {
        tests.startSixMWT();
      }

    });
  });
}

// ---------------- EXPORTS ----------------
exports.initBLE = initBLE;
exports.send = send;
