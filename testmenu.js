Bangle.loadWidgets();
Bangle.drawWidgets();

const storage = require("Storage");

// ---------------- SETTINGS ----------------

let settings = {
  sensors: ["steps", "accel", "hr"], // default
  interval: 10,                      // seconds
  filename: "mobistudy_log.csv"
};

// ---------------- STATE ----------------

let isCollecting = false;
let logTimer = null;
let hrTimer = null;
let file = null;

let lastTotalStepCount = -1;
let currentStepCount = 0;

let accelSum = 0;
let accelSamples = 0;

let hr = 0;
let hrConfidence = 0;
let isMeasuringHR = false;

// ---------------- FILE LOGGING ----------------

function appendRow(ts, steps, accel, hr, conf, batt) {
  if (!file) return;
  const line = [
    ts,
    steps ?? "",
    accel ?? "",
    hr ?? "",
    conf ?? "",
    batt
  ].join(",") + "\n";
  file.write(line);
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

// HR-mätning
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
  if (isCollecting) return;

  isCollecting = true;
  Bangle.buzz(300);

  // Skapa/öppna fil (w = overwrite, sedan bara append med file.write)
  file = storage.open(settings.filename, "w");
  file.write("timestamp,steps,accel,hr,hr_confidence,battery\n");

  // Turn on chosen sensors
  if (settings.sensors.includes("steps")) enableStepSensor();
  if (settings.sensors.includes("accel")) enableAccelSensor();

  // HR-timer starts separatly
  if (settings.sensors.includes("hr")) {
    measureHR(); // första direkt
    hrTimer = setInterval(measureHR, 20000);
  }

  // Periodic logging
  logTimer = setInterval(() => {
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

    currentStepCount = 0;
    accelSum = 0;
    accelSamples = 0;

  }, settings.interval * 1000);
}

function stopCollection() {
  if (!isCollecting) return;

  isCollecting = false;

  if (logTimer) clearInterval(logTimer);
  if (hrTimer) clearInterval(hrTimer);

  logTimer = null;
  hrTimer = null;

  Bangle.removeAllListeners("step");
  Bangle.removeAllListeners("accel");
  Bangle.removeAllListeners("HRM");
  Bangle.setHRMPower(false);

  if (file) {
    file = null; // handle stängs automatiskt
  }

  Bangle.buzz(200);
}

// Bluetooth commands - need some work, dont work as they should in espruino IDE

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

// Menu 

function showMainMenu() {
  E.showMenu({
    "": { title: "Mobistudy" },

    "Start": () => startCollection(),
    "Stop": () => stopCollection(),
    "Sensorer": () => showSensorList()
  });
}

function showSensorList() {
  let menu = {
    "": { title: "Aktiva sensorer" },
    "< Tillbaka": () => showMainMenu()
  };

  let allSensors = ["steps", "accel", "hr"];

  allSensors.forEach(s => {
    menu[s] = {
      value: settings.sensors.includes(s),
      onchange: v => {
        if (v) {
          if (!settings.sensors.includes(s)) settings.sensors.push(s);
        } else {
          settings.sensors = settings.sensors.filter(x => x !== s);
        }
      }
    };
  });

  E.showMenu(menu);
}

showMainMenu();
