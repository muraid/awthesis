// ---------------- IMPORTS ----------------
const { settings } = require("settings.js");
const logging = require("logging.js");

// ---------------- STATE ----------------
let emaON = false;
let emaTimer = null;

// ---------------- FUNCTIONS ----------------
function sendEMA() {
  if (!emaON) return;

  // Only show alert — no menus, no BLE
  E.showAlert("Get up!");
}

function startEMA() {
  // EMA only allowed in aggregated logging mode
  if (!logging.isAggregated()) return;
  if (emaON) return;

  emaON = true;
  Bangle.buzz(300);

  emaTimer = setInterval(() => {
    sendEMA();
  }, settings.emaInterval * 1000);
}

function stopEMA() {
  if (!emaON) return;

  emaON = false;

  if (emaTimer) {
    clearInterval(emaTimer);
    emaTimer = null;
  }

  Bangle.buzz(200);
}

// ---------------- EXPORTS ----------------
exports.startEMA = startEMA;
exports.stopEMA = stopEMA;
exports.sendEMA = sendEMA;
exports.isEMAOn = () => emaON;
