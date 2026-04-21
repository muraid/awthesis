// ---------------- IMPORTS ----------------
const { settings } = require("settings.js");

// ---------------- SENSOR STATE ----------------
let hrmOn = false;
let accelOn = false;
let stepOn = false;
let magOn = false;
let pressureOn = false;
let tempOn = false;
let gpsOn = false;

let startTime = 0;
let isStreaming = false;

let lastAcc = null;
let lastTemp = null;
let lastMag = null;
let lastGPS = null;

let lastStepStream = -1;
let lastStepAgg = -1;
let currentStepCount = 0;

let accelSum = 0;
let accelSamples = 0;

let tempSum = 0;
let tempSamples = 0;

let hr = 0;
let hrConfidence = 0;

let hrmBuffer = [];

let baroOn = false;

// Callback for streaming output (BLE sets this)
let streamCallback = null;

// ---------------- STREAMING CONTROL ----------------
function startStreaming() {
  isStreaming = true;
  startTime = Date.now();
}

function stopStreaming() {
  isStreaming = false;
}

// ---------------- SET STREAM CALLBACK ----------------
function setStreamCallback(cb) {
  streamCallback = cb;
}

// ---------------- BAROMETER POWER ----------------
function ensureBaroOn() {
  if (!baroOn) {
    baroOn = true;
    Bangle.setBarometerPower(true);
  }
}

function maybeBaroOff() {
  if (!tempOn && !pressureOn && baroOn) {
    baroOn = false;
    Bangle.setBarometerPower(false);
  }
}

// ---------------- SENSOR START/STOP ----------------
function startHRM() {
  if (hrmOn) return;
  hrmOn = true;
  Bangle.on("HRM", onHRM);
  Bangle.setHRMPower(1);
}

function stopHRM() {
  if (!hrmOn) return;
  hrmOn = false;
  Bangle.removeListener("HRM", onHRM);
  Bangle.setHRMPower(0);
}

function startAccel() {
  if (accelOn) return;
  accelOn = true;
  Bangle.on("accel", onACC);
  Bangle.getAccel(1);
}

function stopAccel() {
  if (!accelOn) return;
  accelOn = false;
  Bangle.removeListener("accel", onACC);
  Bangle.getAccel(0);
}

function startSteps() {
  if (stepOn) return;
  stepOn = true;
  lastStepStream = -1;
  lastStepAgg = -1;
  currentStepCount = 0;
  Bangle.on("step", onSTEP);
}

function stopSteps() {
  if (!stepOn) return;
  stepOn = false;
  Bangle.removeListener("step", onSTEP);
  lastStepStream = -1;
  lastStepAgg = -1;
  currentStepCount = 0;
}

function startMag() {
  if (magOn) return;
  magOn = true;
  Bangle.setCompassPower(true);
}

function stopMag() {
  if (!magOn) return;
  magOn = false;
  Bangle.setCompassPower(false);
}

function startPressure() {
  if (pressureOn) return;
  pressureOn = true;
  ensureBaroOn();
}

function stopPressure() {
  if (!pressureOn) return;
  pressureOn = false;
  maybeBaroOff();
}

function startTemp() {
  if (tempOn) return;
  tempOn = true;
  ensureBaroOn();
}

function stopTemp() {
  if (!tempOn) return;
  tempOn = false;
  maybeBaroOff();
}

function startGps() {
  if (gpsOn) return;
  gpsOn = true;
  Bangle.setGPSPower(true);
}

function stopGps() {
  if (!gpsOn) return;
  gpsOn = false;
  Bangle.setGPSPower(false);
}

// ---------------- SENSOR HANDLERS ----------------
function onHRM(d) {
  if (isStreaming && streamCallback) {
    const ms = Date.now() - startTime;
    streamCallback(`DATA,HR,${ms},${d.bpm},${d.confidence || 0}`);
  }

  if (!settings.rawMode && d.confidence > 0 && d.bpm > 0) {
    hrmBuffer.push(d);
  }

  if (settings.rawMode) {
    hr = d.bpm;
    hrConfidence = d.confidence;
  }
}

function measureHR() {
  if (hrmBuffer.length === 0) {
    hr = 0;
    hrConfidence = 0;
  } else {
    let best = hrmBuffer.reduce((a, b) =>
      (b.confidence || 0) > (a.confidence || 0) ? b : a
    );
    hr = best.bpm;
    hrConfidence = best.confidence || 0;
  }
  hrmBuffer = [];
}

function onSTEP(s) {
  if (!settings.rawMode && stepOn) {
    if (lastStepAgg < 0) {
      lastStepAgg = s;
      return;
    }
    const diff = s - lastStepAgg;
    if (diff >= 0) currentStepCount += diff;
    lastStepAgg = s;
  }

  if (isStreaming && stepOn && streamCallback) {
    if (lastStepStream < 0) {
      lastStepStream = s;
      return;
    }
    const diff = s - lastStepStream;
    if (diff >= 0) currentStepCount += diff;
    lastStepStream = s;

    const ms = Date.now() - startTime;
    streamCallback(`DATA,STEPS,${ms},${currentStepCount}`);
  }
}

function onACC(a) {
  lastAcc = a;

  if (!settings.rawMode && accelOn) {
    accelSum += Math.abs(a.mag - 1);
    accelSamples++;
  }

  if (isStreaming && accelOn && streamCallback) {
    const ms = Date.now() - startTime;
    streamCallback(`DATA,ACC,${ms},${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`);
  }
}

// ---------------- EXPORTS ----------------
exports.startHRM = startHRM;
exports.stopHRM = stopHRM;

exports.startAccel = startAccel;
exports.stopAccel = stopAccel;

exports.startSteps = startSteps;
exports.stopSteps = stopSteps;

exports.startMag = startMag;
exports.stopMag = stopMag;

exports.startPressure = startPressure;
exports.stopPressure = stopPressure;

exports.startTemp = startTemp;
exports.stopTemp = stopTemp;

exports.startGps = startGps;
exports.stopGps = stopGps;

exports.onHRM = onHRM;
exports.onACC = onACC;
exports.onSTEP = onSTEP;
exports.measureHR = measureHR;

exports.startStreaming = startStreaming;
exports.stopStreaming = stopStreaming;

exports.setStreamCallback = setStreamCallback;

// Export sensor state for logging.js
exports.state = {
  get hr() { return hr; },
  get hrConfidence() { return hrConfidence; },
  get lastAcc() { return lastAcc; },
  get lastTemp() { return lastTemp; },
  get lastMag() { return lastMag; },
  get lastGPS() { return lastGPS; },
  get currentStepCount() { return currentStepCount; },
  get accelSum() { return accelSum; },
  get accelSamples() { return accelSamples; },
  get tempSum() { return tempSum; },
  get tempSamples() { return tempSamples; }
};
