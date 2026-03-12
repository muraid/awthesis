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

  Bangle.on("GPS", m => {
  if (testRunning && magOn) {
    const ms = Date.now() - startTime;
    send(`DATA,MAG,${ms},${m.x.toFixed(3)},${m.y.toFixed(3)},${m.z.toFixed(3)}`);
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
    send(`DATA,GPS,${ms},${g.x.toFixed(3)},${g.y.toFixed(3)}`);
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
        send("STOPPED");
      }
    });
  });

  Terminal.setConsole(true);

})();
