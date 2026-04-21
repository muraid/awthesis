// ---------------- IMPORTS ----------------
const logging = require("logging.js");
const { send } = require("ble.js");

// ---------------- STATE ----------------
let sixMWTInterval;
let sixMWTSeconds = 360; // 6 minutes

// ---------------- 6-MINUTE WALK TEST ----------------
function startSixMWT() {
  sixMWTSeconds = 360;

  // Start aggregated logging
  logging.startCollection();

  // Event start
  let ts = Math.round(Date.now() / 1000);
  send(`EVENT,6MWT_START,${ts}`);
  logging.appendEventRow(1);

  Bangle.buzz();

  sixMWTInterval = setInterval(() => {
    sixMWTSeconds--;

    if (sixMWTSeconds <= 0) {
      clearInterval(sixMWTInterval);
      sixMWTInterval = undefined;

      // Event end
      let ts2 = Math.round(Date.now() / 1000);
      send(`EVENT,6MWT_END,${ts2}`);
      logging.appendEventRow(2);

      Bangle.buzz();

      // Stop logging
      logging.stopCollection();
    }
  }, 1000);
}

// ---------------- EXPORTS ----------------
exports.startSixMWT = startSixMWT;
