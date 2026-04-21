// ---------------- IMPORTS ----------------
const { settings, config, RAW_FILE_LEN, AGG_FILE_LEN } = require("settings.js");
const sensors = require("sensors.js");
const ema = require("ema.js");
const storage = require("Storage");

// ---------------- STATE ----------------
let rows = [];
let isAggregated = false;
let logTimer = null;
let hrTimer = null;

// ---------------- HELPERS ----------------
function numToBytes(num, len) {
  let arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = num & 255;
    num >>= 8;
  }
  return arr;
}

// ---------------- FILE LOGGING ----------------
function flushRows() {
  if (rows.length === 0) return;

  let rowSize = settings.rawMode ? 20 : 9;
  let block = new Uint8Array(rows.length * rowSize);

  let pos = 0;
  for (let r of rows) {
    block.set(r, pos);
    pos += rowSize;
  }

  if (config.appendPos + block.length > config.totalLen) {
    console.log("FILE FULL");
    return;
  }

  storage.write(config.filename, block, config.appendPos, config.totalLen);
  config.appendPos += block.length;
  rows = [];
}

function appendRawRow() {
  let st = sensors.state;
  let row = new Uint8Array(20);
  let pos = 0;

  // timestamp
  let ts = Math.round(Date.now() / 1000);
  row.set(numToBytes(ts, 4), pos); pos += 4;

  // steps
  row[pos++] = st.currentStepCount & 255;

  // hr
  row[pos++] = st.hr & 255;

  // temp
  row[pos++] = st.lastTemp ? Math.round(st.lastTemp) : 0;

  // accel
  let ax = st.lastAcc ? Math.round(st.lastAcc.x * 50) : 0;
  let ay = st.lastAcc ? Math.round(st.lastAcc.y * 50) : 0;
  let az = st.lastAcc ? Math.round(st.lastAcc.z * 50) : 0;
  row[pos++] = ax;
  row[pos++] = ay;
  row[pos++] = az;

  // mag
  let mx = st.lastMag ? Math.round(st.lastMag.x) : 0;
  let my = st.lastMag ? Math.round(st.lastMag.y) : 0;
  let mz = st.lastMag ? Math.round(st.lastMag.z) : 0;
  row[pos++] = mx;
  row[pos++] = my;
  row[pos++] = mz;

  // gps
  let lat = st.lastGPS ? Math.round(st.lastGPS.lat * 10000) : 0;
  let lon = st.lastGPS ? Math.round(st.lastGPS.lon * 10000) : 0;
  row.set(numToBytes(lat, 2), pos); pos += 2;
  row.set(numToBytes(lon, 2), pos); pos += 2;

  // battery
  let batt = Math.round(E.getBattery() * 10);
  row.set(numToBytes(batt, 2), pos); pos += 2;

  // padding
  row[pos++] = 0;

  rows.push(row);
  if (rows.length >= settings.ramSize) flushRows();
}

function appendAggRow(ts) {
  let st = sensors.state;
  let row = new Uint8Array(9);

  row.set(numToBytes(ts, 4), 0);

  row[4] = st.currentStepCount & 255;

  let accelAvg = st.accelSamples ? (st.accelSum / st.accelSamples) : 0;
  row[5] = Math.min(255, Math.round(accelAvg * 100));

  row[6] = st.hr & 255;
  row[7] = st.hrConfidence & 255;

  let tempAvg = st.tempSamples ? (st.tempSum / st.tempSamples) : 0;
  row[8] = Math.round(tempAvg);

  rows.push(row);
  if (rows.length >= settings.ramSize) flushRows();
}

function appendEventRow(code) {
  let rowSize = settings.rawMode ? 20 : 9;
  let row = new Uint8Array(rowSize);

  let ts = Math.round(Date.now() / 1000);
  row.set(numToBytes(ts, 4), 0);

  row[4] = code;

  rows.push(row);
}

// ---------------- DATA COLLECTION ----------------
function startCollection() {
  isAggregated = !settings.rawMode;
  let isRaw = settings.rawMode;

  // choose file
  if (isRaw) {
    config.filename = "collectedRawData.bin";
    config.totalLen = RAW_FILE_LEN;
  } else {
    config.filename = "collectedAggData.bin";
    config.totalLen = AGG_FILE_LEN;
  }

  Bangle.buzz(300);

  storage.erase(config.filename);
  storage.write(config.filename, new Uint8Array(config.totalLen), 0, config.totalLen);
  config.appendPos = 0;
  rows = [];

  // ---- AGGREGATED MODE ----
  if (!isRaw) {
    if (settings.sensors.includes("steps")) sensors.startSteps();
    if (settings.sensors.includes("accel")) sensors.startAccel();
    if (settings.sensors.includes("temp")) sensors.startTemp();
    if (settings.sensors.includes("hr")) {
      sensors.startHRM();
      hrTimer = setInterval(sensors.measureHR, 20000);
    }

    if (settings.emaEnabled) ema.startEMA();
  }

  // ---- RAW MODE ----
  if (isRaw) {
    sensors.startSteps();
    sensors.startAccel();
    sensors.startHRM();
    sensors.startTemp();
    sensors.startPressure();
    sensors.startMag();
    sensors.startGps();

    logTimer = setInterval(() => {
      appendRawRow();
      sensors.state.currentStepCount = 0;
    }, settings.interval * 1000);

    return;
  }

  // ---- AGGREGATED INTERVAL ----
  logTimer = setInterval(() => {
    let ts = Math.round(Date.now() / 1000);

    appendAggRow(ts);

    sensors.state.currentStepCount = 0;
    sensors.state.accelSum = 0;
    sensors.state.accelSamples = 0;
    sensors.state.tempSum = 0;
    sensors.state.tempSamples = 0;

  }, settings.interval * 1000);
}

function stopCollection() {
  if (rows.length > 0) flushRows();

  if (logTimer) clearInterval(logTimer);
  if (hrTimer) clearInterval(hrTimer);

  logTimer = null;
  hrTimer = null;

  sensors.stopSteps();
  sensors.stopAccel();
  sensors.stopHRM();
  sensors.stopTemp();
  sensors.stopPressure();
  sensors.stopMag();
  sensors.stopGps();

  ema.stopEMA();

  isAggregated = false;

  Bangle.buzz(200);
}

// ---------------- EXPORTS ----------------
exports.startCollection = startCollection;
exports.stopCollection = stopCollection;
exports.appendEventRow = appendEventRow;
exports.appendRawRow = appendRawRow;
exports.appendAggRow = appendAggRow;
exports.isAggregated = () => isAggregated;
