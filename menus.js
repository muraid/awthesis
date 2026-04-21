// ---------------- IMPORTS ----------------
const { settings } = require("settings.js");
const storage = require("Storage");
const logging = require("logging.js");
const tests = require("tests.js");
const ema = require("ema.js");

// ---------------- MAIN MENU ----------------
function showMainMenu() {
  E.showMenu({
    "": { title: "AW app" },

    "Start streaming": () => {
      Bluetooth.setConsole(false);
      Terminal.setConsole(true);
      E.showAlert("Ready for web app").then(() => showMainMenu());
    },

    "Local logging": () => showLoggingMenu(),
    "Timed test": () => timedTest(),
    "EMA settings": () => showEMAMenu()
  });
}

// ---------------- INTERVAL MENU ----------------
function intervalMenu() {
  E.showMenu({
    "": { title: "Sampling Interval (sec)" },

    "Value": {
      value: settings.interval,
      min: 5, max: 190, step: 1,
      format: v => v + " s",
      onchange: v => {
        settings.interval = v;
        storage.writeJSON("awapp.settings.json", settings);
      }
    },

    "< Back": () => showMainMenu()
  });
}

// ---------------- SENSOR LIST ----------------
function showSensorList() {
  let menu = {
    "": { title: "Active sensors" },
    "< Back": () => showMainMenu()
  };

  let allSensors = ["steps", "accel", "hr", "temp"];

  allSensors.forEach(s => {
    menu[s] = {
      value: settings.sensors.includes(s),
      onchange: v => {
        if (v) {
          if (!settings.sensors.includes(s)) settings.sensors.push(s);
        } else {
          settings.sensors = settings.sensors.filter(x => x !== s);
        }
        storage.writeJSON("awapp.settings.json", settings);
      }
    };
  });

  E.showMenu(menu);
}

// ---------------- LOGGING MENU ----------------
function showLoggingMenu() {
  E.showMenu({
    "": { title: "Logging" },

    "Raw data": {
      value: settings.rawMode,
      onchange: v => {
        settings.rawMode = true;
        storage.writeJSON("awapp.settings.json", settings);
        showLoggingMenu();
      }
    },

    "Aggregated data": {
      value: !settings.rawMode,
      onchange: v => {
        settings.rawMode = false;
        storage.writeJSON("awapp.settings.json", settings);
        showLoggingMenu();
      }
    },

    "Ramsize": {
      value: settings.ramSize,
      min: 1, max: 6144, step: 256,
      format: v => v + " rows",
      onchange: v => {
        settings.ramSize = v;
        storage.writeJSON("awapp.settings.json", settings);
      }
    },

    "Choose sensors": () => showSensorList(),
    "Set Interval": () => intervalMenu(),
    "Start": () => logging.startCollection(),
    "Stop": () => logging.stopCollection(),

    "< Back": () => showMainMenu()
  });
}

// ---------------- TIMED TEST MENU ----------------
function timedTest() {
  E.showMenu({
    "Choose sensors": () => showSensorList(),
    "Set Interval": () => intervalMenu(),
    "Start 6MWT": () => tests.startSixMWT(),
    "< Back": () => showMainMenu()
  });
}

// ---------------- EMA MENU ----------------
function showEMAMenu() {
  E.showMenu({
    "": { title: "EMA Settings" },

    "Enabled": {
      value: settings.emaEnabled,
      onchange: v => {
        settings.emaEnabled = v;
        storage.writeJSON("awapp.settings.json", settings);

        if (!v) ema.stopEMA();
      }
    },

    "Interval (sec)": {
      value: settings.emaInterval,
      min: 60, max: 86400, step: 60,
      format: v => v + " s",
      onchange: v => {
        settings.emaInterval = v;
        storage.writeJSON("awapp.settings.json", settings);

        if (settings.emaEnabled) {
          ema.stopEMA();
          ema.startEMA();
        }
      }
    },

    "Test Alert": () => ema.sendEMA(),

    "< Back": () => showMainMenu()
  });
}

// ---------------- EXPORTS ----------------
exports.showMainMenu = showMainMenu;
exports.showEMAMenu = showEMAMenu;
