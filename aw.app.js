(() => {
  //Bluetooth.setConsole(false);
  Bangle.loadWidgets();
  Bangle.drawWidgets();

  const storage = require("Storage");

  // ---------------- SETTINGS ----------------

  let settings = {
    sensors: ["steps", "accel", "hr", "temp"], // default
    interval: 10, // seconds
  };

  const config = {
    filename: "mobs.bin",
    bytesPerStepCount: 1
  };

  // 4 bytes timestamp + 1 step + 1 accel + 1 HR + 1 conf + 1 battery + 1 temp + 1 padding = 11 bytes per row
  const bytesPerRow = 11;
  const totalFileLen = 28800;

  let writtenRows = 0;

  // ---------------- STREAMING STATE ----------------
  let hrmOn = false;
  let accelOn = false;
  let stepOn = false;
  let magOn = false;
  let pressureOn = false;
  let tempOn = false;
  let gpsOn = false;
  let streamStepTimer = null;

  // ---------------- STATE ----------------
  let startTime = 0;
  let isAggregated = false; // logging mode
  let isStreaming = false;
  let logTimer = null;
  let hrTimer = null;

  let lastStepStream = -1;
  let lastStepAgg = -1;
  let currentStepCount = 0;

  let accelSum = 0;
  let accelSamples = 0;

  let tempSum = 0;
  let tempSamples = 0;

  let hr = 0;
  let hrConfidence = 0;

  // HR buffer för "bästa 20s"
  let hrmBuffer = [];

  // barometer shared state (temp + pressure)
  let baroOn = false;

  // 6MWT Countdown 
  let sixMWTInterval;
  let sixMWTSeconds = 360; // 6 minutes


  function send(line) {
    Bluetooth.println(line);
  }

  function numToBytes(num, len) {
    let arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = num & 255;
      num >>= 8;
    }
    return arr;
  }

  // ---------------- FILE LOGGING ----------------

  function appendRow(ts, step, accel, hr, conf, batt, temp) {
    let dataRowUint8Array = new Uint8Array(bytesPerRow);

    // timestamp (4 bytes)
    let timestampBytes = numToBytes(ts, 4);
    for (let i = 0; i < 4; i++) {
      dataRowUint8Array[i] = timestampBytes[i];
    }

    // step count (configurable bytes)
    let stepBytes = numToBytes(step || 0, config.bytesPerStepCount);
    for (let i = 0; i < stepBytes.length; i++) {
      dataRowUint8Array[4 + i] = stepBytes[i];
    }

    // accel, hr, conf, batt, temp
    dataRowUint8Array[4 + config.bytesPerStepCount]     = accel   || 0;
    dataRowUint8Array[4 + config.bytesPerStepCount + 1] = hr      || 0;
    dataRowUint8Array[4 + config.bytesPerStepCount + 2] = conf    || 0;
    dataRowUint8Array[4 + config.bytesPerStepCount + 3] = batt    || 0;
    dataRowUint8Array[4 + config.bytesPerStepCount + 4] = temp    || 0;

    // padding (sista byte lämnas 0)

    require("Storage").write(config.filename, dataRowUint8Array, writtenRows * bytesPerRow, totalFileLen);
    writtenRows++;
  }

  function appendEventRow(eventCode) {
  let ts = Math.round(Date.now() / 1000);

  // eventCode = 1 för start, 2 för slut
  // vi lägger det i "step"-fältet (byte 4)
  let dataRowUint8Array = new Uint8Array(bytesPerRow);

  // timestamp
  let timestampBytes = numToBytes(ts, 4);
  for (let i = 0; i < 4; i++) {
    dataRowUint8Array[i] = timestampBytes[i];
  }

  // event code i step-fältet
  dataRowUint8Array[4] = eventCode;

  // skriv raden
  require("Storage").write(config.filename, dataRowUint8Array, writtenRows * bytesPerRow, totalFileLen);
  writtenRows++;
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
    send("DEBUG: HRM STARTED");
  }

  function stopHRM() {
    if (!hrmOn) return;
    hrmOn = false;
    Bangle.removeListener("HRM", onHRM);
    Bangle.setHRMPower(0);
    send("DEBUG: HRM STOPPED");
  }

  function startAccel() {
    if (accelOn) return;
    accelOn = true;
    Bangle.on("accel", onACC);
    Bangle.getAccel(1);
    send("DEBUG: ACCEL STARTED");
  }

  function stopAccel() {
    if (!accelOn) return;
    accelOn = false;
    Bangle.removeListener("accel", onACC);
    Bangle.getAccel(0);
    send("DEBUG: ACCEL STOPPED");
  }

  function startSteps() {
    if (stepOn) return;
    stepOn = true;
    lastStepStream = -1;
    lastStepAgg = -1;
    currentStepCount = 0;
    Bangle.on("step", onSTEP);
    send("DEBUG: STEPS STARTED");
  }

  function stopSteps() {
    if (!stepOn) return;
    stepOn = false;
    Bangle.removeListener("step", onSTEP);
    lastStepStream = -1;
    lastStepAgg = -1;
    currentStepCount = 0;
    send("DEBUG: STEPS STOPPED");
  }

  function startMag() {
    if (magOn) return;
    magOn = true;
    Bangle.setCompassPower(true);
    send("DEBUG: MAG STARTED");
  }

  function stopMag() {
    if (!magOn) return;
    magOn = false;
    Bangle.setCompassPower(false);
    send("DEBUG: MAG STOPPED");
  }

  function startPressure() {
    if (pressureOn) return;
    pressureOn = true;
    ensureBaroOn();
    send("DEBUG: PRESSURE STARTED");
  }

  function stopPressure() {
    if (!pressureOn) return;
    pressureOn = false;
    maybeBaroOff();
    send("DEBUG: PRESSURE STOPPED");
  }

  function startTemp() {
    if (tempOn) return;
    tempOn = true;
    ensureBaroOn();
    send("DEBUG: TEMP STARTED");
  }

  function stopTemp() {
    if (!tempOn) return;
    tempOn = false;
    maybeBaroOff();
    send("DEBUG: TEMP STOPPED");
  }

  function startGps() {
    if (gpsOn) return;
    gpsOn = true;
    Bangle.setGPSPower(true);
    send("DEBUG: GPS STARTED");
  }

  function stopGps() {
    if (!gpsOn) return;
    gpsOn = false;
    Bangle.setGPSPower(false);
    send("DEBUG: GPS STOPPED");
  }

  // ---------------- SENSOR HANDLERS ----------------

  function onHRM(d) {
    // STREAMING
    if (isStreaming) {
      const ms = Date.now() - startTime;
      send(`DATA,HR,${ms},${d.bpm},${d.confidence || 0}`);
    }

    // AGGREGATED: buffra för "bästa 20s"
    if (isAggregated && d.confidence > 0 && d.bpm > 0) {
      hrmBuffer.push(d);
    }
  }

  // HR-mätning: bästa HR under senaste 20 sek
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
  // --- LOGGING (aggregated) ---
  if (isAggregated && stepOn) {
    if (lastStepAgg < 0) {
      lastStepAgg = s;
      return;
    }
    const diff = s - lastStepAgg;
    if (diff >= 0) currentStepCount += diff;
    lastStepAgg = s;
  }

  // --- STREAMING (räkna steg även om vi inte skickar direkt) ---
  if (isStreaming && stepOn) {
    if (lastStepStream < 0) {
      lastStepStream = s;
      return;
    }
    const diff = s - lastStepStream;
    if (diff >= 0) currentStepCount += diff;
    lastStepStream = s;
  }
  }

  function onACC(a) {
    // LOGGING (aggregated rörelse)
    if (isAggregated && accelOn) {
      accelSum += Math.abs(a.mag - 1);
      accelSamples++;
    }

    // STREAMING
    if (isStreaming && accelOn) {
      const ms = Date.now() - startTime;
      send(`DATA,ACC,${ms},${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`);
    }
  }

  //function for 6 minutes walking test
 function startSixMWT() {
  sixMWTSeconds = 360;

  // --- Start sensors for aggregated data ---
  if (settings.sensors.includes("steps")) startSteps();
  if (settings.sensors.includes("accel")) startAccel();
  if (settings.sensors.includes("temp")) startTemp();
  if (settings.sensors.includes("hr")) {
    startHRM();
    hrmBuffer = [];
    hrTimer = setInterval(measureHR, 20000);
  }

  // --- Event + debug ---
  let ts = Math.round(Date.now() / 1000);
  send(`EVENT,6MWT_START,${ts}`);
  appendEventRow(1);

  // Buzz at start
  Bangle.buzz();

  // --- Countdown ---
  sixMWTInterval = setInterval(() => {
    sixMWTSeconds--;

    if (sixMWTSeconds <= 0) {
      clearInterval(sixMWTInterval);
      sixMWTInterval = undefined;

      let ts2 = Math.round(Date.now() / 1000);
      send(`EVENT,6MWT_END,${ts2}`);
      appendEventRow(2);

      // Buzz twice at end
      Bangle.buzz();
      Bangle.buzz();

      // --- Stop sensors after test ---
      stopSteps();
      stopAccel();
      stopTemp();
      stopPressure();
      stopMag();
      stopGps();

      if (hrTimer) clearInterval(hrTimer);
      hrTimer = null;
      stopHRM();
    }
  }, 1000);
  }

  // ------------- Streaming extra sensorer -------------

  Bangle.on("mag", m => {
    if (isStreaming && magOn) {
      const ms = Date.now() - startTime;
      send(`DATA,MAG,${ms},${m.x.toFixed(3)},${m.y.toFixed(3)},${m.z.toFixed(3)}`);
    }
  });

  Bangle.on("pressure", b => {
    // TEMP logging (aggregated)
    if (isAggregated && tempOn) {
      tempSum += b.temperature;
      tempSamples++;
    }

    // TEMP streaming
    if (isStreaming && tempOn) {
      const ms = Date.now() - startTime;
      send(`DATA,TEMP,${ms},${b.temperature.toFixed(2)}`);
    }

    // PRESSURE streaming
    if (isStreaming && pressureOn) {
      const ms = Date.now() - startTime;
      send(`DATA,pressure,${ms},${b.pressure.toFixed(2)},${b.altitude.toFixed(2)},${b.temperature.toFixed(2)}`);
    }
  });

  Bangle.on("GPS", g => {
    if (isStreaming && gpsOn) {
      const ms = Date.now() - startTime;
      send(`DATA,GPS,${ms},${g.lat.toFixed(6)},${g.lon.toFixed(6)},${g.alt}`);
    }
  });

  // ---------------- DATA COLLECTION (AGGREGATED) ----------------

  function startCollection() {
    if (isAggregated) return;

    isAggregated = true;
    Bangle.buzz(300);

    writtenRows = 0;
    storage.erase(config.filename);

    if (settings.sensors.includes("steps")) startSteps();
    if (settings.sensors.includes("accel")) startAccel();
    if (settings.sensors.includes("temp")) startTemp();

    if (settings.sensors.includes("hr")) {
      startHRM();
      hrmBuffer = [];
      hrTimer = setInterval(measureHR, 20000);
    }

    logTimer = setInterval(() => {
      let ts = Math.round(Date.now() / 1000);
      let batt = E.getBattery();

      let accelAvg = accelSamples ? (accelSum / accelSamples) : 0;
      let accelByte = Math.min(255, Math.round(accelAvg * 100));

      let tempAvg = tempSamples ? (tempSum / tempSamples) : 0;
      let tempByte = Math.round(tempAvg); // °C som heltal

      appendRow(
        ts,
        settings.sensors.includes("steps") ? currentStepCount : null,
        settings.sensors.includes("accel") ? accelByte : null,
        settings.sensors.includes("hr") ? hr : null,
        settings.sensors.includes("hr") ? hrConfidence : null,
        batt,
        settings.sensors.includes("temp") ? tempByte : null
      );

      currentStepCount = 0;
      accelSum = 0;
      accelSamples = 0;
      tempSum = 0;
      tempSamples = 0;

    }, settings.interval * 1000);
  }

  function stopCollection() {
    if (!isAggregated) return;

    isAggregated = false;

    if (logTimer) clearInterval(logTimer);
    if (hrTimer) clearInterval(hrTimer);

    logTimer = null;
    hrTimer = null;

    stopSteps();
    stopAccel();
    stopHRM();
    stopTemp();
    stopPressure();
    stopMag();
    stopGps();

    Bangle.buzz(200);
  }

  // ---------------- BLUETOOTH COMMANDS (STREAMING) ----------------

  Bluetooth.on("data", function(d) {
    d.split("\n").forEach(cmd => {
      cmd = cmd.trim();
      if (!cmd) return;

      send("DEBUG: GOT CMD " + cmd);

      if (cmd === "HR_ON") startHRM();
      if (cmd === "HR_OFF") stopHRM();

      if (cmd === "ACC_ON") startAccel();
      if (cmd === "ACC_OFF") stopAccel();

      if (cmd === "STEPS_ON") startSteps();
      if (cmd === "STEPS_OFF") stopSteps();

      if (cmd === "MAG_ON") startMag();
      if (cmd === "MAG_OFF") stopMag();

      if (cmd === "pressure_ON") startPressure();
      if (cmd === "pressure_OFF") stopPressure();

      if (cmd === "TEMP_ON") startTemp();
      if (cmd === "TEMP_OFF") stopTemp();

      if (cmd === "GPS_ON") startGps();
      if (cmd === "GPS_OFF") stopGps();

      if (cmd === "START") {
        isStreaming = true;
        isAggregated = false;
        startTime = Date.now();
        // --- STEPS: send every 10 seconds even if no steps are taken ---
          if (streamStepTimer) clearInterval(streamStepTimer);
          streamStepTimer = setInterval(() => {
            if (isStreaming && stepOn) {
              const ms = Date.now() - startTime;
              send(`DATA,STEPS,${ms},${currentStepCount}`);
            }
          }, 10000); // every 10 seconds

        if (hrmOn) startHRM();
        if (accelOn) startAccel();
        if (stepOn) startSteps();
        if (magOn) startMag();
        if (pressureOn) startPressure();
        if (tempOn) startTemp();
        if (gpsOn) startGps();
        send("DEBUG: TEST STARTED");
      }

      if (cmd === "STOP") {
        isStreaming = false;
        if (streamStepTimer) {
          clearInterval(streamStepTimer);
          streamStepTimer = null;
        }
        stopHRM();
        stopAccel();
        stopSteps();
        stopMag();
        stopPressure();
        stopTemp();
        stopGps();
        send("STOPPED");
      }
    });
  });

  // ---------------- MENU ----------------

  function showMainMenu() {
    E.showMenu({
      "": { title: "AW app" },

      "Start streaming": () => {
        E.showMessage("Streaming\nControlled on the webb");
      },

      "Local logging": () => showLoggingMenu(),

      "Timed test": () => timedTest(),

      "Stop collection": () => {
        stopCollection();
      }
    });
  }

  function intervalMenu() {
    const menu = {
      "" : { title : "Sampling Interval (sec)" },
      "Value" : {
        value : settings.interval,
        min : 5, max : 190, step : 1,
        format : v => v + " s",
        onchange : v => {
          settings.interval = v;
          storage.writeJSON("awapp.settings.json", settings);
        }
      },
      "< Back" : () => { showMainMenu(); }
    };
    E.showMenu(menu);
  }

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
        }
      };
    });

    E.showMenu(menu);
  }

  function showLoggingMenu() {
    E.showMenu({
      "": { title: "Logging" },
      "Choose sensors": () => showSensorList(),
      "Set Interval": () => intervalMenu(),
      "Start": () => startCollection(),
      "Stop": () => stopCollection(),
      "< Back": () => showMainMenu()
    });
  }

  function timedTest(){
    E.showMenu({
      "Choose sensors": () => showSensorList(),
      "Set Interval": () => intervalMenu(),
      "Start 6MWT" : () => startSixMWT(),
      "< Back": () => showMainMenu()
    });

    }

  showMainMenu();
  //Terminal.setConsole(true);
})();