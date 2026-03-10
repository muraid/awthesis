Bangle.loadWidgets();
Bangle.drawWidgets();

const storage = require("Storage");

// ---------------- SETTINGS ----------------

let settings = storage.readJSON("mobistudy.json", 1) || {
  interval: 10,
  vibration: true,
  accelerometer: true,
  gyroscope: true,
  heartRate: true,
  filename: "mobistudy_log.csv",
  continuous: false,
  sporadic: false
};

function saveSettings() {
  storage.writeJSON("mobistudy.json", settings);
}

// ---------------- CONFIG ----------------

const config = {
  filename: settings.filename || "mobistudy.bin",
  samplingPeriod: settings.interval,
  bytesPerStepCount: 1
};

// ---------------- STATE VARIABLES ----------------

let lastTotalStepCount = -1;
let currentStepCount = 0;

let accelSum = 0;
let accelSamples = 0;

let hr = 0;
let hrConfidence = 0;

let isMeasuringHR = false;

// ---------------- FILE LOGGING ----------------

function appendRow(ts, steps, accel, hr, conf, batt) {
  const line = [
    ts,
    steps,
    accel,
    hr,
    conf,
    batt
  ].join(",") + "\n";

  storage.write(config.filename, line, storage.APPEND);
}

// ---------------- HEART RATE ----------------

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

function startDataCollection() {
  E.showMessage("Samlar data...", "Mobistudy");

  // STEP COUNTER
  Bangle.on("step", s => {
    if (lastTotalStepCount < 0) lastTotalStepCount = s - 1;
    currentStepCount = s - lastTotalStepCount;
  });

  // ACCELEROMETER
  Bangle.on("accel", a => {
    accelSum += Math.abs(a.mag - 1);
    accelSamples++;
  });

  // PERIODIC LOGGING
  setInterval(() => {
    let ts = Math.round(Date.now() / 1000);

    let accelAvg = accelSamples ? (accelSum / accelSamples) : 0;
    let accelByte = Math.min(255, Math.round(accelAvg * 100));

    let batt = E.getBattery();

    appendRow(ts, currentStepCount, accelByte, hr, hrConfidence, batt);

    // reset
    currentStepCount = 0;
    accelSum = 0;
    accelSamples = 0;

    // trigger HR measurement
    if (settings.heartRate) measureHR();

  }, settings.interval * 1000);
}

// ---------------- MENUS ----------------

function showStartMenu() {
  const menu = {
    "": { title: "Mobistudy" },
    "< Tillbaka": () => load(),

    "Sensorer": () => showSensorMenu(),
    "Tidsstyrda tester": () => showTimedTestsMenu(),
    "EMA": () => showEMAMenu(),

    "Starta mätning": () => startDataCollection()
  };

  E.showMenu(menu);
}

function showSensorMenu() {
  E.showMenu({
    "": { title: "Sensorer" },
    "< Tillbaka": () => showStartMenu(),

    "Accelerometer": {
      value: settings.accelerometer,
      onchange: v => { settings.accelerometer = v; saveSettings(); }
    },
    "Gyroskop": {
      value: settings.gyroscope,
      onchange: v => { settings.gyroscope = v; saveSettings(); }
    },
    "Puls": {
      value: settings.heartRate,
      onchange: v => { settings.heartRate = v; saveSettings(); }
    }
  });
}

function showTimedTestsMenu() {
  E.showMenu({
    "": { title: "Tidsstyrda tester" },
    "< Tillbaka": () => showStartMenu()
  });
}

function showEMAMenu() {
  E.showMenu({
    "": { title: "EMA" },
    "< Tillbaka": () => showStartMenu()
  });
}

// ---------------- START ----------------

showStartMenu();
