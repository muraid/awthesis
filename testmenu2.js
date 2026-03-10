Bangle.loadWidgets();
Bangle.drawWidgets();

const storage = require("Storage");

// ---------------- SETTINGS ----------------

let settings = {
  sensors: ["steps", "accel", "hr"], // default
  interval: 10,
  filename: "mobistudy_log.csv"
};

// ---------------- STATE ----------------
let file;
let isCollecting = false;

let lastTotalStepCount = -1;
let currentStepCount = 0;

let accelSum = 0;
let accelSamples = 0;

let hr = 0;
let hrConfidence = 0;
let isMeasuringHR = false;

let intervalID = null;

// ---------------- FILE LOGGING ----------------

function appendRow(ts, steps, accel, hr, conf, batt) {
  const line = [
    ts,
    steps ?? "",
    accel ?? "",
    hr ?? "",
    conf ?? "",
    batt
  ].join(",") + "\n";

  storage.write(settings.filename, line, storage.APPEND);
}

// ---------------- SENSOR HANDLERS ----------------

function enableStepSensor() {
  Bangle.on("step", s => {
    if (lastTotalStepCount < 0) lastTotalStepCount = s - 1;
    currentStepCount = s - lastTotalStepCount;
  });
}

function enableAccelSensor() {
  Bangle.on("accel", a => {
    accelSum += Math.abs(a.mag - 1);
    accelSamples++;
  });
}

function measureHR() {
  if (isMeasuringHR) return;

  isMeasuringHR = true;
  let samples = [];

  function onHRM(e) {
    if (e.confidence > 0 && e.bpm > 0) samples.push(e);
  }

  Bangle.on("HRM", onHRM);
  Bangle.setHRMPower(true);

  setTimeout(() => {
    Bangle.removeListener("HRM", onHRM);
    Bangle.setHRMPower(false);
    isMeasuringHR = false;

    if (samples.length === 0) {
      hr = 0;
      hrConfidence = 0;
    } else {
      let best = samples.reduce((a, b) =>
        b.confidence > a.confidence ? b : a
      );
      hr = best.bpm;
      hrConfidence = best.confidence;
    }
  }, 20000);
}

// ---------------- DATA COLLECTION ----------------
function startCollection() {
  const menu = {
    "": { "title": "Timed tests" },

    "Back": () => showMainMenu(),

    "Start": () => {
      if (isCollecting) return;

      isCollecting = true;
      Bangle.buzz(500);

      file = require("Storage").open(settings.filename, "a");
      file.write("timestamp,steps,accel,hr,hr_confidence,battery\n");

      // Aktivera valda sensorer
      if (settings.sensors.includes("steps")) enableStepSensor();
      if (settings.sensors.includes("accel")) enableAccelSensor();
      if (settings.sensors.includes("hr")) enableHeartRateSensor();

      // Starta periodic logging
      intervalID = setInterval(() => {
        let row = [ts,currentStepCount,accelSamples ? (accelSum / accelSamples) : 0,hr,hrConfidence,E.getBattery()].join(",") + "\n";
        file.write(row);
        let ts = Math.round(Date.now() / 1000);
        let batt = E.getBattery();

        let accelAvg = accelSamples ? (accelSum / accelSamples) : 0;
        let accelByte = Math.min(255, Math.round(accelAvg * 100));

        appendRow(
          ts,
          settings.sensors.includes("steps") ? currentStepCount : null,
          settings.sensors.includes("accel") ? accelByte : null,
          settings.sensors.includes("hr") ? hr : null,
          settings.sensors.includes("hr") ? hrConfidence : null,
          batt
        );

        // Reset
        currentStepCount = 0;
        accelSum = 0;
        accelSamples = 0;

        if (settings.sensors.includes("hr")) measureHR();

      }, settings.interval * 1000);
      
    }
  };

  E.showMenu(menu);
}



function stopCollection() {
  if (!isCollecting) return;

  isCollecting = false;
  clearInterval(intervalID);
  intervalID = null;

  Bangle.removeAllListeners("step");
  Bangle.removeAllListeners("accel");
  Bangle.removeAllListeners("HRM");
  Bangle.setHRMPower(false);
  if (file) {
    file = undefined;
  }
  
}

// ---------------- BLUETOOTH COMMANDS ----------------

Bluetooth.on("data", d => {
  d = d.trim();

  if (d.startsWith("SET SENSORS:")) {
    try {
      let json = d.replace("SET SENSORS:", "").trim();
      let list = JSON.parse(json);

      if (Array.isArray(list)) {
        settings.sensors = list;
        Bluetooth.println("OK: Sensors updated");
      } else {
        Bluetooth.println("ERR: Invalid sensor list");
      }
    } catch (e) {
      Bluetooth.println("ERR: JSON parse failed");
    }
  }

  if (d === "START") {
    startCollection();
    Bluetooth.println("OK: Started");
  }

  if (d === "STOP") {
    stopCollection();
    Bluetooth.println("OK: Stopped");
  }
});

// ---------------- MENY ----------------

function showMainMenu() {
  E.showMenu({
    "": { title: "Mobistudy" },
    
    "Sensors": () => showSensorList(),
    "Start": () => startCollection(),
    "Stop": () => stopCollection(),

    
  });
}

function showSensorList() {
  let menu = {
    "": { title: "Sensorer" },
    "< Tillbaka": () => showMainMenu()
  };

  settings.sensors.forEach(s => {
    menu[s] = { value: true };
  });

  E.showMenu(menu);
}

// ---------------- START ----------------

showMainMenu();
