(() => {
 // ---------------- BAS / INIT ----------------

 //Bluetooth.setConsole(false); // needs to be activated to test data streaming with webapp.

 Bangle.loadWidgets();
 Bangle.drawWidgets();

 const storage = require("Storage");

 let settings = {
   sensors: ["steps", "accel", "hr"],
   interval: 10,
   filename: "mobistudy_log.csv"
 };

 let isCollecting = false;
 let logTimer = null;
 let hrTimer = null;

 let lastTotalStepCountLog = -1;
 let currentStepCountLog = 0;

 let accelSumLog = 0;
 let accelSamplesLog = 0;

 let hrLog = 0;
 let hrConfidenceLog = 0;

 // ---------------- STREAMING-DEL ----------------
 let hrmOn = false;
 let testRunning = false;
 let startTime = 0;
 let accelOn = false;
 let stepOn = false;
 let magOn = false;
 let pressureOn = false;
 let tempOn = false;
 let gpsOn = false;

 let lastTotalStepCount = -1;
 let currentStepCount = 0;

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

 // ---------------- SENSOR START/STOP ----------------
 function startHRM() {
   if (hrmOn) return;
   hrmOn = true;
   Bangle.setHRMPower(1);
 }

 function stopHRM() {
   if (!hrmOn) return;
   hrmOn = false;
   if (!isCollecting) Bangle.setHRMPower(0);
 }

 function startAccel() {
   if (accelOn) return;
   accelOn = true;
 }

 function stopAccel() {
   if (!accelOn) return;
   accelOn = false;
 }

 function startSteps() {
   if (stepOn) return;
   stepOn = true;
   lastTotalStepCount = -1;
   currentStepCount = 0;
 }

 function stopSteps() {
   if (!stepOn) return;
   stepOn = false;
   lastTotalStepCount = -1;
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
   if (!isCollecting) Bangle.setCompassPower(false);
 }

 function startPressure() {
   if (pressureOn) return;
   pressureOn = true;
   Bangle.setBarometerPower(true);
 }

 function stopPressure() {
   if (!pressureOn) return;
   pressureOn = false;
   if (!isCollecting) Bangle.setBarometerPower(false);
 }

 function startTemp() {
   if (tempOn) return;
   tempOn = true;
   Bangle.setBarometerPower(true);
 }

 function stopTemp() {
   if (!tempOn) return;
   tempOn = false;
   if (!isCollecting) Bangle.setBarometerPower(false);
 }

 function startGps() {
   if (gpsOn) return;
   gpsOn = true;
   Bangle.setGPSPower(true);
 }

 function stopGps() {
   if (!gpsOn) return;
   gpsOn = false;
   if (!isCollecting) Bangle.setGPSPower(false);
 }

 // ---------------- AGGREGATION ----------------
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
     send(`AGG,STEPS,${ms},${currentStepCount}`);
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

 // ---------------- GEMENSAMMA SENSOR-EVENT ----------------
 Bangle.on("HRM", d => {
   if (testRunning && hrmOn) {
     if (samplingPeriod > 0) hrmBuffer.push(d);
     else send(`DATA,HR,${Date.now()-startTime},${d.bpm},${d.confidence||0}`);
   }

   if (isCollecting && settings.sensors.includes("hr")) {
     if (d.confidence > 0 && d.bpm > 0) {
       hrLog = d.bpm;
       hrConfidenceLog = d.confidence;
     }
   }
 });

 Bangle.on("accel", a => {
   if (testRunning && accelOn) {
     if (samplingPeriod > 0) accelBuffer.push(a);
     else send(`DATA,ACC,${Date.now()-startTime},${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`);
   }

   if (isCollecting && settings.sensors.includes("accel")) {
     accelSumLog += Math.abs(a.mag - 1);
     accelSamplesLog++;
   }
 });

 Bangle.on("step", s => {
   if (testRunning && stepOn) {
     if (lastTotalStepCount < 0) {
       lastTotalStepCount = s;
       return;
     }
     const diff = s - lastTotalStepCount;
     if (diff >= 0) {
       currentStepCount += diff;
       lastTotalStepCount = s;
     }
     if (samplingPeriod === 0) {
       send(`DATA,STEPS,${Date.now()-startTime},${currentStepCount}`);
       currentStepCount = 0;
     }
   }

   if (isCollecting && settings.sensors.includes("steps")) {
     if (lastTotalStepCountLog < 0) lastTotalStepCountLog = s - 1;
     currentStepCountLog = s - lastTotalStepCountLog;
   }
 });

 Bangle.on("MAG", m => {
   if (testRunning && magOn) {
     if (samplingPeriod > 0) magBuffer.push(m);
     else send(`DATA,MAG,${Date.now()-startTime},${m.x.toFixed(3)},${m.y.toFixed(3)},${m.z.toFixed(3)}`);
   }
 });

 Bangle.on("pressure", b => {
   if (testRunning && pressureOn) {
     if (samplingPeriod > 0) pressureBuffer.push(b);
     else send(`DATA,pressure,${Date.now()-startTime},${b.pressure.toFixed(2)},${b.altitude.toFixed(2)},${b.temperature.toFixed(2)}`);
   }

   if (testRunning && tempOn) {
     if (samplingPeriod > 0) tempBuffer.push(b);
     else send(`DATA,TEMP,${Date.now()-startTime},${b.temperature.toFixed(2)}`);
   }
 });

 Bangle.on("GPS", g => {
   if (testRunning && gpsOn) {
     if (samplingPeriod > 0) gpsBuffer.push(g);
     else send(`DATA,GPS,${Date.now()-startTime},${g.lat.toFixed(6)},${g.lon.toFixed(6)},${g.alt}`);
   }
 });

 // ---------------- LOGGNING ----------------
 function startCollection() {
   if (isCollecting) return;

   testRunning = false;
   isCollecting = true;
   Bangle.buzz(300);

   storage.write(settings.filename,
     "timestamp, steps, accel, hr, hr_confidence, battery\n"
   );

   if (settings.sensors.includes("hr")) startHRM();
   if (settings.sensors.includes("accel")) startAccel();
   if (settings.sensors.includes("steps")) startSteps();

   logTimer = setInterval(() => {
     let ts = Math.round(Date.now() / 1000);
     let batt = E.getBattery();

     let accelAvg = accelSamplesLog ? (accelSumLog / accelSamplesLog) : 0;
     let accelByte = Math.min(255, Math.round(accelAvg * 100));

     let f = storage.open(settings.filename, "a");
     f.write([
       ts,
       settings.sensors.includes("steps") ? currentStepCountLog : "",
       settings.sensors.includes("accel") ? accelByte : "",
       settings.sensors.includes("hr") ? hrLog : "",
       settings.sensors.includes("hr") ? hrConfidenceLog : "",
       batt
     ].join(",") + "\n");

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

   Bangle.buzz(200);
 }

 // ---------------- BLUETOOTH STREAMING ----------------
 Bluetooth.on("data", function(d) {
   d.split("\n").forEach(cmd => {
     cmd = cmd.trim();
     if (!cmd) return;

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

       if (aggTimer) clearInterval(aggTimer);

       if (samplingPeriod > 0) {
         aggTimer = setInterval(sendAggregatedData, samplingPeriod);
       }
     }

     if (cmd === "START") {
       isCollecting = false;
       testRunning = true;
       startTime = Date.now();
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

       if (aggTimer) clearInterval(aggTimer);
     }
   });
 });

 // ---------------- MENY ----------------
 function stopAll() {
   stopCollection();
   resetUI();

   testRunning = false;
   stopHRM();
   stopAccel();
   stopSteps();
   stopMag();
   stopPressure();
   stopTemp();
   stopGps();

   if (aggTimer) clearInterval(aggTimer);

   E.showMessage("Stoppad");
 }

 function resetUI() {
  testRunning = false;
  isCollecting = false;

  if (aggTimer) clearInterval(aggTimer);
  if (logTimer) clearInterval(logTimer);
  if (hrTimer) clearInterval(hrTimer);

  aggTimer = null;
  logTimer = null;
  hrTimer = null;

  lastTotalStepCount = -1;
  currentStepCountLog = 0;
  currentStepCount = 0;
  accelSumLog = 0;
  accelSamplesLog = 0;
}

 function showLoggingMenu() {
   E.showMenu({
     "": { title: "Logging" },
     "Välj sesnorer": () => showSensorList(),
     "Start logging": () => startCollection(),
     "< Tillbaka": () => showMainMenu()
   });
 }

 function showSensorList() {
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
   E.showMenu({
     "": { title: "Mobistudy" },
     "Starta streaming": () => E.showMessage("Streaming\nStyrs från webbapp"),
     "Logga på klockan": () => showLoggingMenu(),
     "Stoppa allt": () => stopAll(),
     "Sensorer": () => showSensorList()
   });
 }

 showMainMenu();

  //Terminal.setConsole(true); // needs to be activated to test data streaming with webapp.


})();