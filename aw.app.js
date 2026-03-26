(() => {
  //Bluetooth.setConsole(false); // needs to be activated to test data streaming with webapp.
Bangle.loadWidgets();
Bangle.drawWidgets();

const storage = require("Storage");

// ---------------- SETTINGS ----------------

let settings = {
  sensors: ["steps", "accel", "hr"], // default
  interval: 10,                      // seconds
  filename: "mobistudy_log.csv"
};

// ---------------- STREAMING-DEL (från testapp.js) ----------------
let hrmOn = false;
let accelOn = false;
let stepOn = false;
let magOn = false;
let pressureOn = false;
let tempOn = false;
let gpsOn = false;


// ---------------- STATE ----------------
let startTime = 0;
let isAggregated = false;
let isStreaming = false;
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

let pressure = null;
let temperature = null;
let gps = null;

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

 // -----------------------------
 // SENSOR START/STOP FUNCTIONS (streaming)
 // -----------------------------
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

 function startAccel (){
   if (accelOn) return;
   accelOn = true;
   Bangle.on("accel", onACC);
   Bangle.getAccel(1);
   send("DEBUG: ACCEL STARTED");
 }

 function stopAccel (){
   if (!accelOn) return;
   accelOn = false;
   Bangle.removeListener("accel", onACC);
   Bangle.getAccel(0);
   send("DEBUG: ACCEL STOPPED");
 }

 function startSteps (){
   if (stepOn) return;
   stepOn = true;
   Bangle.on("step", onSTEP);
   lastTotalStepCount = -1;
   currentStepCount = 0;
   send("DEBUG: STEPS STARTED");
 }

 function stopSteps (){
   if (!stepOn) return;
   stepOn = false;
   Bangle.removeListener("step", onSTEP);
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
// SENSOR HANDLERS 
// -----------------------------

function onHRM(d) {
  // --- STREAMING MODE ---
  if (isStreaming) {
    const ms = Date.now() - startTime;
    send(`DATA,HR,${ms},${d.bpm},${d.confidence || 0}`);
  }

//aggregated
  if (isAggregated) {
    if (d.confidence > 0 && d.bpm > 0) {
      hrmBuffer.push(d);
    }
  }
}

// HR-mätning
function measureHR() {
  hrmBuffer = [];

  startHRM();

  setTimeout(() => {

    if (hrmBuffer.length === 0) {
      hr = 0;
      hrConfidence = 0;
    } else {
      let best = hrmBuffer.reduce((a, b) =>
        b.confidence > a.confidence ? b : a
      );
      hr = best.bpm;
      hrConfidence = best.confidence;
    }

  }, 20000);
}


function onSTEP(s) {
  if (isStreaming && stepOn) {
    const ms = Date.now() - startTime;
    send(`DATA,STEPS,${ms},${s}`);
  }
  if (isAggregated && stepOn) {
   if (lastTotalStepCount < 0) {
     lastTotalStepCount = s;
     return;
   }


   const diff = s - lastTotalStepCount;
   if (diff >= 0) currentStepCount += diff;
    lastTotalStepCount = s;
   }
  }

function onACC(a) {
  // --- LOGGING MODE (file logging) ---
  if (isAggregated) {
    accelSum += Math.abs(a.mag - 1);
    accelSamples++;
  }

  // --- STREAMING MODE ---
  if (isStreaming && accelOn) {
    const ms = Date.now() - startTime;
    send(`DATA,ACC,${ms},${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`);
  }

  // --- AGGREGATED MODE ---
  if (isAggregated && accelOn) {
    accelBuffer.push(a);
  }
}


//-------------
// Streaming
//-------------

 Bangle.on("MAG", m => {
   if (isStreaming && magOn) {
     if (samplingPeriod > 0) magBuffer.push(m);
     else {
       const ms = Date.now() - startTime;
       send(`DATA,MAG,${ms},${m.x.toFixed(3)},${m.y.toFixed(3)},${m.z.toFixed(3)}`);
     }
   }
 });


 Bangle.on("pressure", b => {
   if (isStreaming && pressureOn) {
     if (samplingPeriod > 0) pressureBuffer.push(b);
     else {
       const ms = Date.now() - startTime;
       send(`DATA,pressure,${ms},${b.pressure.toFixed(2)},${b.altitude.toFixed(2)},${b.temperature.toFixed(2)}`);
     }
   }


   if (isStreaming && tempOn) {
     if (samplingPeriod > 0) tempBuffer.push(b);
     else {
       const ms = Date.now() - startTime;
       send(`DATA,TEMP,${ms},${b.temperature.toFixed(2)}`);
     }
   }
 });


 Bangle.on("GPS", g => {
   if (isStreaming && gpsOn) {
     if (samplingPeriod > 0) gpsBuffer.push(g);
     else {
       const ms = Date.now() - startTime;
       send(`DATA,GPS,${ms},${g.lat.toFixed(6)},${g.lon.toFixed(6)},${g.alt}`);
     }
   }
 });

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
     send(`AGG,STEP,${ms2},${currentStepCount}`);
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

// ---------------- DATA COLLECTION ----------------

function startCollection() {
  if (isAggregated) return;

  isAggregated = true;
  Bangle.buzz(300);

  // Skapa/öppna fil (w = overwrite, sedan bara append med file.write)
  file = storage.open(settings.filename, "w");
  file.write("timestamp,steps,accel,hr,hr_confidence,battery\n");

  // Turn on chosen sensors
  if (settings.sensors.includes("steps")) startSteps();
  if (settings.sensors.includes("accel")) startAccel();

  // HR-timer starts separatly
  if (settings.sensors.includes("hr")) {
    startHRM();
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
  if (!isAggregated) return;

  isAggregated = false;

  if (logTimer) clearInterval(logTimer);
  if (hrTimer) clearInterval(hrTimer);

  logTimer = null;
  hrTimer = null;

  stopSteps();
  stopAccel();
  stopHRM();

  if (file) {
    file.close(); // handle stängs automatiskt
  }

  Bangle.buzz(200);
}

// Bluetooth commands - need some work, dont work as they should in espruino IDE
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
       isAggregated = true;
       startTime = Date.now();
       send("DEBUG: TEST STARTED");
     }


     if (cmd === "STOP") {
       isAggregated = false;

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


// -----------------
// Menu
//------------------
function showMainMenu() {
   E.showMenu({
     "": { title: "AW app" },

     "Starta streaming": () => {
       E.showMessage("Streaming\nStyrs från webbapp");
     },

     "Logg on the watch": () => showLoggingMenu(),

     "Stopp all": () => {
       stopCollection();
     },

     "Sensors": () => showSensorList()
   });
 }


function showSensorList() {
  let menu = {
    "": { title: "Active sensors" },
    "< Back": () => showMainMenu()
  };

  let allSensors = ["steps", "accel", "hr", "mag"];

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

 function showLoggingMenu(){
   E.showMenu({
     "": { title: "Logging" },
     "Choose sensors": () => showSensorList(),
     "Start": () => startCollection(),
     "Stop": () => stopCollection(),

     "< Back": () => showMainMenu()

   });
 }

showMainMenu();
 //Terminal.setConsole(true); // needs to be activated to test data streaming with webapp.
})();