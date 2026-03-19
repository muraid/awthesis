(() => {

  // Disable REPL on Bluetooth
  Bluetooth.setConsole(false);

  // Keep screen awake
  Bangle.setLCDTimeout(0);

  // Safe UI init
  E.showMessage("STREAM APP\nWaiting for BLE...");

  let hrmOn = false;
  let testRunning = false;
  let startTime = 0;
  let accelOn = false;
  let stepOn = false;
  let magOn = false;
  let pressureOn = false;
  let tempOn = false;
  let gpsOn = false;

   //steps 
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
  // SENSOR START/STOP FUNCTIONS
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

    // HRM
    if (hrmBuffer.length > 0) {
      const avgBpm = hrmBuffer.reduce((s,v)=>s+v.bpm,0) / hrmBuffer.length;
      const avgConf = hrmBuffer.reduce((s,v)=>s+(v.confidence||0),0) / hrmBuffer.length;
      send(`AGG,HR,${ms},${avgBpm.toFixed(1)},${avgConf.toFixed(1)}`);
      hrmBuffer = [];
    }

    // ACC
    if (accelBuffer.length > 0) {
      const avg = axisAvg(accelBuffer);
      send(`AGG,ACC,${ms},${avg.x},${avg.y},${avg.z}`);
      accelBuffer = [];
    }

    //steps 
    if (stepOn && currentStepCount > 0) {
      const ms = Date.now() - startTime;
      send(`AGG,STEPS,${ms},${currentStepCount}`);
      currentStepCount = 0; //nollställs efter varje aggregering
    }

    // MAG
    if (magBuffer.length > 0) {
      const avg = axisAvg(magBuffer);
      send(`AGG,MAG,${ms},${avg.x},${avg.y},${avg.z}`);
      magBuffer = [];
    }

    // PRESSURE
    if (pressureBuffer.length > 0) {
      const avgP = pressureBuffer.reduce((s,v)=>s+v.pressure,0)/pressureBuffer.length;
      const avgAlt = pressureBuffer.reduce((s,v)=>s+v.altitude,0)/pressureBuffer.length;
      const avgT = pressureBuffer.reduce((s,v)=>s+v.temperature,0)/pressureBuffer.length;
      send(`AGG,pressure,${ms},${avgP.toFixed(2)},${avgAlt.toFixed(2)},${avgT.toFixed(2)}`);
      pressureBuffer = [];
    }

    // TEMP
    if (tempBuffer.length > 0) {
      const avgT = tempBuffer.reduce((s,v)=>s+v.temperature,0)/tempBuffer.length;
      send(`AGG,TEMP,${ms},${avgT.toFixed(2)}`);
      tempBuffer = [];
    }

    // GPS
    if (gpsBuffer.length > 0) {
      const avgLat = gpsBuffer.reduce((s,v)=>s+v.lat,0)/gpsBuffer.length;
      const avgLon = gpsBuffer.reduce((s,v)=>s+v.lon,0)/gpsBuffer.length;
      const avgAlt = gpsBuffer.reduce((s,v)=>s+v.alt,0)/gpsBuffer.length;
      send(`AGG,GPS,${ms},${avgLat.toFixed(6)},${avgLon.toFixed(6)},${avgAlt.toFixed(1)}`);
      gpsBuffer = [];
    }
  }

  // -----------------------------
  // SENSOR EVENTS (RAW + AGG)
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

    if (lastTotalStepCount < 0) lastTotalStepCount = s - 1;

    const diff = s - lastTotalStepCount;
    if (diff < 0) return;

    currentStepCount = diff;

    const ms = Date.now() - startTime;

    //Raw
    if (samplingPeriod === 0) {
      send(`DATA,STEPS,${ms},${currentStepCount}`);
      lastTotalStepCount = s; 
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
  // BLUETOOTH COMMAND HANDLER
  // -----------------------------
  Bluetooth.on("data", function(d) {
    d.split("\n").forEach(cmd => {
      cmd = cmd.trim();
      if (!cmd) return;

      send("DEBUG: GOT CMD " + cmd);

      // SENSOR COMMANDS
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

      // AGGREGATION COMMAND
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

      // START/STOP
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

  Terminal.setConsole(true);

})();
