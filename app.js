(() => {

  // ---------------- BAS / INIT ----------------

  //Bluetooth.setConsole(false); // needs to be activated to test data streaming with webapp. 

  Bangle.loadWidgets();
  Bangle.drawWidgets();

  const storage = require("Storage");

  // ---------------- STREAMING-DEL (från testapp.js) ----------------

  let hrmOn = false;
  let testRunning = false;
  let startTime = 0;
  let accelOn = false;
  let stepOn = false;
  let magOn = false;
  let pressureOn = false;
  let tempOn = false;
  let gpsOn = false;

  // steps (streaming)
  let lastTotalStepCount = -1;
  let currentStepCount = 0;

  // Aggregation variables
  let samplingPeriod = 0;
  let aggTimer = null;

  let hrmBuffer = [];
  let accelBuffer = [];
  let magBuffer = [];
  let pressureBuffer = [];
  let tempBuffer = [];
  let gpsBuffer = [];

  function send(line) {
    Bluetooth.println(line);
  }

  // -----------------------------
  // SENSOR START/STOP FUNCTIONS (streaming)
  // -----------------------------
  function startHRM() {
    if (hrmOn) return;
    hrmOn = true;
    Bangle.setHRMPower(1);
    send("DEBUG: HRM STARTED");
  }

  function stopHRM() {
    if (!hrmOn) return;
    hrmOn = false;
    Bangle.setHRMPower(0);
    send("DEBUG: HRM STOPPED");
  }

  function startAccel (){
    if (accelOn) return;
    accelOn = true;
    Bangle.setAccelPower(1);
    send("DEBUG: ACCEL STARTED");
  }

  function stopAccel (){
    if (!accelOn) return;
    accelOn = false;
    Bangle.setAccelPower(0);
    send("DEBUG: ACCEL STOPPED");
  }

  function startSteps (){
    if (stepOn) return;
    stepOn = true;
    lastTotalStepCount = -1;
    currentStepCount = 0;
    send("DEBUG: STEPS STARTED");
  }

  function stopSteps (){
    if (!stepOn) return;
    stepOn = false;
    lastTotalStepCount = -1;
    currentStepCount = 0;
    send("DEBUG: STEPS STOPPED");
  }

  function startMag (){
    if (magOn) return;
    magOn = true;
    Bangle.setCompassPower(true);
    send("DEBUG: MAG STARTED");
  }

  function stopMag (){
    if (!magOn) return;
    magOn = false;
    Bangle.setCompassPower(false);
    send("DEBUG: MAG STOPPED");
  }

  function startPressure (){
    if (pressureOn) return;
    pressureOn = true;
    Bangle.setBarometerPower(true);
    send("DEBUG: BAR STARTED");
  }

  function stopPressure (){
    if (!pressureOn) return;
    pressureOn = false;
    Bangle.setBarometerPower(false);
    send("DEBUG: BAR STOPPED");
  }

  function startTemp() {
    if (tempOn) return;
    tempOn = true;
    Bangle.setBarometerPower(true);
    send("DEBUG: TEMP STARTED");
  }

  function stopTemp() {
    if (!tempOn) return;
    tempOn = false;
    Bangle.setBarometerPower(false);
    send("DEBUG: TEMP STOPPED");
  }

  function startGps (){
    if (gpsOn) return;
    gpsOn = true;
    Bangle.setGPSPower(true);
    send("DEBUG: GPS STARTED");
  }

  function stopGps (){
    if (!gpsOn) return;
    gpsOn = false;
    Bangle.setGPSPower(false);
    send("DEBUG: GPS STOPPED");
  }

  // -----------------------------
  // AGGREGATION HELPERS
  // -----------------------------
  function axisAvg(arr) {
    return {
      x: (arr.reduce((s,v)=>s+v.x,0)/arr.length).toFixed(3),
      y: (arr.reduce((s,v)=>s+v.y,0)/arr.length).toFixed(3),
      z: (arr.reduce((s,v)=>s+v.z,0)/arr.length).toFixed(3)
    };
  }

  function sendAggregatedData() {
    const ms = Date.now() - startTime;

    if (hrmBuffer.length > 0) {
      const avgBpm = hrmBuffer.reduce((s,v)=>s+v.bpm,0) / hrmBuffer.length;
      const avgConf = hrmBuffer.reduce((s,v)=>s+(v.confidence||0),0) / hrmBuffer.length;
      send(`AGG,HR,${ms},${avgBpm.toFixed(1)},${avgConf.toFixed(1)}`);
      hrmBuffer = [];
    }

    if (accelBuffer.length > 0) {
      const avg = axisAvg(accelBuffer);
      send(`AGG,ACC,${ms},${avg.x},${avg.y},${avg.z}`);
      accelBuffer = [];
    }

    if (stepOn && currentStepCount > 0) {
      const ms2 = Date.now() - startTime;
      send(`AGG,STEPS,${ms2},${currentStepCount}`);
      currentStepCount = 0;
    }

    if (magBuffer.length > 0) {
      const avgM = axisAvg(magBuffer);
      send(`AGG,MAG,${ms},${avgM.x},${avgM.y},${avgM.z}`);
      magBuffer = [];
    }

    if (pressureBuffer.length > 0) {
      const avgP = pressureBuffer.reduce((s,v)=>s+v.pressure,0)/pressureBuffer.length;
      const avgAlt = pressureBuffer.reduce((s,v)=>s+v.altitude,0)/pressureBuffer.length;
      const avgT = pressureBuffer.reduce((s,v)=>s+v.temperature,0)/pressureBuffer.length;
      send(`AGG,pressure,${ms},${avgP.toFixed(2)},${avgAlt.toFixed(2)},${avgT.toFixed(2)}`);
      pressureBuffer = [];
    }

    if (tempBuffer.length > 0) {
      const avgT2 = tempBuffer.reduce((s,v)=>s+v.temperature,0)/tempBuffer.length;
      send(`AGG,TEMP,${ms},${avgT2.toFixed(2)}`);
      tempBuffer = [];
    }

    if (gpsBuffer.length > 0) {
      const avgLat = gpsBuffer.reduce((s,v)=>s+v.lat,0)/gpsBuffer.length;
      const avgLon = gpsBuffer.reduce((s,v)=>s+v.lon,0)/gpsBuffer.length;
      const avgAlt2 = gpsBuffer.reduce((s,v)=>s+v.alt,0)/gpsBuffer.length;
      send(`AGG,GPS,${ms},${avgLat.toFixed(6)},${avgLon.toFixed(6)},${avgAlt2.toFixed(1)}`);
      gpsBuffer = [];
    }
  }

  // -----------------------------
  // SENSOR EVENTS (streaming)
  // -----------------------------
  Bangle.on("HRM", d => {
    if (testRunning && hrmOn) {
      if (samplingPeriod > 0) hrmBuffer.push(d);
      else {
        const ms = Date.now() - startTime;
        send(`DATA,HR,${ms},${d.bpm},${d.confidence || 0}`);
      }
    }
  });

  Bangle.on("accel", a => {
    if (testRunning && accelOn) {
      if (samplingPeriod > 0) accelBuffer.push(a);
      else {
        const ms = Date.now() - startTime;
        send(`DATA,ACC,${ms},${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`);
      }
    }
  });

  Bangle.on("step", s => {
    if (!testRunning || !stepOn) return;

    if (lastTotalStepCount < 0) {
      lastTotalStepCount = s;
      return;
    }

    const diff = s - lastTotalStepCount;
    if (diff < 0) {
      lastTotalStepCount = s;
      return;
    }

    currentStepCount += diff;
    lastTotalStepCount = s;

    const ms = Date.now() - startTime;

    if (samplingPeriod === 0) {
      send(`DATA,STEPS,${ms},${currentStepCount}`);
      currentStepCount = 0;
    }
  });

  Bangle.on("MAG", m => {
    if (testRunning && magOn) {
      if (samplingPeriod > 0) magBuffer.push(m);
      else {
        const ms = Date.now() - startTime;
        send(`DATA,MAG,${ms},${m.x.toFixed(3)},${m.y.toFixed(3)},${m.z.toFixed(3)}`);
      }
    }
  });

  Bangle.on("pressure", b => {
    if (testRunning && pressureOn) {
      if (samplingPeriod > 0) pressureBuffer.push(b);
      else {
        const ms = Date.now() - startTime;
        send(`DATA,pressure,${ms},${b.pressure.toFixed(2)},${b.altitude.toFixed(2)},${b.temperature.toFixed(2)}`);
      }
    }

    if (testRunning && tempOn) {
      if (samplingPeriod > 0) tempBuffer.push(b);
      else {
        const ms = Date.now() - startTime;
        send(`DATA,TEMP,${ms},${b.temperature.toFixed(2)}`);
      }
    }
  });

  Bangle.on("GPS", g => {
    if (testRunning && gpsOn) {
      if (samplingPeriod > 0) gpsBuffer.push(g);
      else {
        const ms = Date.now() - startTime;
        send(`DATA,GPS,${ms},${g.lat.toFixed(6)},${g.lon.toFixed(6)},${g.alt}`);
      }
    }
  });

  // -----------------------------
  // LOKAL LOGGNING (från testmenu.js)
  // -----------------------------

  let settings = {
    sensors: ["steps", "accel", "hr"],
    interval: 10,
    filename: "mobistudy_log.csv"
  };

  let isCollecting = false;
  let logTimer = null;
  let hrTimer = null;
  let file = null;

  let lastTotalStepCountLog = -1;
  let currentStepCountLog = 0;

  let accelSumLog = 0;
  let accelSamplesLog = 0;

  let hrLog = 0;
  let hrConfidenceLog = 0;
  let isMeasuringHRLog = false;

  function appendRow(ts, steps, accel, hr, conf, batt) {
    const line = [
      ts,
      steps ?? "",
      accel ?? "",
      hr ?? "",
      conf ?? "",
      batt
    ].join(",") + "\n";
    let f = storage.open(settings.filename, "a");
    f.write(line);
    f = null;
  }

  function enableStepSensorLog() {
    Bangle.on("step", s => {
      if (lastTotalStepCountLog < 0) lastTotalStepCountLog = s - 1;
      currentStepCountLog = s - lastTotalStepCountLog;
    });
  }

  function enableAccelSensorLog() {
    Bangle.on("accel", a => {
      accelSumLog += Math.abs(a.mag - 1);
      accelSamplesLog++;
    });
  }

  function measureHRLog() {
    if (isMeasuringHRLog) return;

    isMeasuringHRLog = true;
    let samples = [];

    function onHRM(e) {
      if (e.confidence > 0 && e.bpm > 0) samples.push(e);
    }

    Bangle.on("HRM", onHRM);
    Bangle.setHRMPower(true);

    setTimeout(() => {
      Bangle.removeListener("HRM", onHRM);
      Bangle.setHRMPower(false);
      isMeasuringHRLog = false;

      if (samples.length === 0) {
        hrLog = 0;
        hrConfidenceLog = 0;
      } else {
        let best = samples.reduce((a, b) =>
          b.confidence > a.confidence ? b : a
        );
        hrLog = best.bpm;
        hrConfidenceLog = best.confidence;
      }
    }, 20000);
  }

  function startCollection() {
    if (isCollecting) return;

    isCollecting = true;
    Bangle.buzz(300);

    storage.write(
      settings.filename,
      "timestamp, steps, accel, hr, hr_confidence, battery\n"
    );

    if (settings.sensors.includes("steps")) enableStepSensorLog();
    if (settings.sensors.includes("accel")) enableAccelSensorLog();

    if (settings.sensors.includes("hr")) {
      measureHRLog();
      hrTimer = setInterval(measureHRLog, 20000);
    }

    logTimer = setInterval(() => {
      let ts = Math.round(Date.now() / 1000);
      let batt = E.getBattery();

      let accelAvg = accelSamplesLog ? (accelSumLog / accelSamplesLog) : 0;
      let accelByte = Math.min(255, Math.round(accelAvg * 100));

      appendRow(
        ts,
        settings.sensors.includes("steps") ? currentStepCountLog : null,
        settings.sensors.includes("accel") ? accelByte : null,
        settings.sensors.includes("hr") ? hrLog : null,
        settings.sensors.includes("hr") ? hrConfidenceLog : null,
        batt
      );

      currentStepCountLog = 0;
      accelSumLog = 0;
      accelSamplesLog = 0;

    }, settings.interval * 1000);
  }

  function stopCollection() {
    if (!isCollecting) return;

    isCollecting = false;

    if (logTimer) clearInterval(logTimer);
    if (hrTimer) clearInterval(hrTimer);

    logTimer = null;
    hrTimer = null;

    Bangle.setHRMPower(false);

    if (file) {
      file = null;
    }

    Bangle.buzz(200);
  }

  // -----------------------------
  // BLUETOOTH COMMAND HANDLER (streaming)
  // -----------------------------
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

      if (cmd.startsWith("SET_PERIOD")) {
        const parts = cmd.split(",");
        samplingPeriod = parseInt(parts[1]) || 0;

        if (aggTimer) {
          clearInterval(aggTimer);
          aggTimer = null;
        }

        if (samplingPeriod > 0) {
          aggTimer = setInterval(sendAggregatedData, samplingPeriod);
          send("DEBUG: AGGREGATION ENABLED " + samplingPeriod + " ms");
        } else {
          send("DEBUG: AGGREGATION DISABLED");
        }
      }

      if (cmd === "START") {
        testRunning = true;
        startTime = Date.now();
        send("DEBUG: TEST STARTED");
      }

      if (cmd === "STOP") {
        testRunning = false;

        stopHRM();
        stopAccel();
        stopSteps();
        stopMag();
        stopPressure();
        stopTemp();
        stopGps();

        if (aggTimer) {
          clearInterval(aggTimer);
          aggTimer = null;
        }

        send("STOPPED");
      }
    });
  });

  // -----------------------------
  // MENY (Mobistudy)
  // -----------------------------

  function stopAll() {
    stopCollection();

    testRunning = false;
    stopHRM();
    stopAccel();
    stopSteps();
    stopMag();
    stopPressure();
    stopTemp();
    stopGps();
    if (aggTimer) {
      clearInterval(aggTimer);
      aggTimer = null;
    }
    E.showMessage("Stoppad");
  }

  function resetUI(){
     testRunning = false; 
    stopHRM();
    stopAccel();
    stopSteps();
    stopMag();
    stopPressure();
    stopTemp();
    stopGps();

    if (aggTimer) {
      clearInterval(aggTimer);
      aggTimer = null;
    }

    if (logTimer) {
      clearInterval(logTimer);
      logTimer = null;
    }
    
    if (hrTimer) {
      clearInterval(hrTimer);
      hrTimer = null;
    }

    lastTotalStepCount = -1;
    currentStepCountLog = 0;
    currentStepCount = 0;
    accelSumLog = 0;
    accelSamplesLog = 0;
  }

  function showLoggingMenu(){
    resetUI();
    E.showMenu({
      "": { title: "Logging" },
      "Välj sesnorer": () => showSensorList(),
      "Start logging": () => {
        startCollection();
      },

      "< Tillbaka": () => showMainMenu()

    });
  }

  function showSensorList() {
    resetUI();
    let menu = {
      "": { title: "Aktiva sensorer" },
      "< Tillbaka": () => showLoggingMenu()
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

  function showMainMenu() {
    resetUI();
    E.showMenu({
      "": { title: "Mobistudy" },

      "Starta streaming": () => {
        E.showMessage("Streaming\nStyrs från webbapp");
      },

      "Logga på klockan": () => showLoggingMenu(),

      "Stoppa allt": () => {
        stopAll();
      },

      "Sensorer": () => showSensorList()
    });
  }

  showMainMenu();

  //Terminal.setConsole(true); // needs to be activated to test data streaming with webapp. 

})();



