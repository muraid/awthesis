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
  let magOn = false;
  let pressureOn = false;
  let tempOn = false;
  let gpsOn = false;

  function send(line) {
    Bluetooth.println(line);
  }

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

  Bangle.on("HRM", d => {
    if (testRunning && hrmOn) {
      const ms = Date.now() - startTime;
      send(`DATA,HR,${ms},${d.bpm},${d.confidence || 0}`);
    }
  });

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

  Bangle.on("accel", a => {
  if (testRunning && accelOn) {
    const ms = Date.now() - startTime;
    send(`DATA,ACC,${ms},${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`);
  }
});

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

  Bangle.on("MAG", m => {
  if (testRunning && magOn) {
    const ms = Date.now() - startTime;
    send(`DATA,MAG,${ms},${m.x.toFixed(3)},${m.y.toFixed(3)},${m.z.toFixed(3)}`);
  }
});

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
    send("DEBUG: TEMP STARTED");
  }

  function stopTemp() {
    if (!tempOn) return;
    tempOn = false;
    send("DEBUG: TEMP STOPPED");
  }

  //Barometer
   Bangle.on("pressure", b => {

    // Pressure-data
    if (testRunning && pressureOn) {
      const ms = Date.now() - startTime;
      send(`DATA,pressure,${ms},${b.pressure.toFixed(2)},${b.altitude.toFixed(2)},${b.temperature.toFixed(2)}`);
    }

    // Temperatur-data (separat)
    if (testRunning && tempOn) {
      const ms = Date.now() - startTime;
      send(`DATA,TEMP,${ms},${b.temperature.toFixed(2)}`);
    }

  });

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

  Bangle.on("GPS", g => {
  if (testRunning && gpsOn) {
    const ms = Date.now() - startTime;
    send(`DATA,GPS,${ms},${g.lat.toFixed(6)},${g.lon.toFixed(6)},${g.alt}`);
  }
});


  Bluetooth.on("data", function(d) {
    d.split("\n").forEach(cmd => {
      cmd = cmd.trim();
      if (!cmd) return;

      send("DEBUG: GOT CMD " + cmd);

      if (cmd === "HR_ON") startHRM();
      if (cmd === "HR_OFF") stopHRM();

      if (cmd == "ACC_ON") startAccel();
      if (cmd == "ACC_OFF") stopAccel();

      if (cmd === "MAG_ON") startMag();
      if (cmd === "MAG_OFF") stopMag();

      if (cmd === "pressure_ON") startPressure();
      if (cmd === "pressure_OFF") stopPressure();
      
      if (cmd === "TEMP_ON") startTemp();
      if (cmd === "TEMP_OFF") stopTemp();

      if (cmd === "GPS_ON") startGps();
      if (cmd === "GPS_OFF") stopGps();

      

      if (cmd === "START") {
        testRunning = true;
        startTime = Date.now();
        send("DEBUG: TEST STARTED");
      }

      if (cmd === "STOP") {
        testRunning = false;
        stopHRM();
        stopAccel();
        stopMag();
        stopPressure();
        stopTemp();
        stopGps();
        send("STOPPED");
      }
    });
  });

  Terminal.setConsole(true);

})();
