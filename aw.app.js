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


// ---------------- STATE ----------------
let isCollecting = false;
let isStreaming = false;
let aggregated = false;
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

// Aggregation variables
let samplingPeriod = 0;
let aggTimer = null;

let hrmBuffer = [];


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
   //send("DEBUG: HRM STARTED");
 }

 function stopHRM() {
   if (!hrmOn) return;
   hrmOn = false;
   Bangle.removeListener("HRM", onHRM);
   Bangle.setHRMPower(0);
   //send("DEBUG: HRM STOPPED");
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
  if (isCollecting) {
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


function enableStepSensor() {
  Bangle.on("step", s => {
    if (lastTotalStepCount < 0) lastTotalStepCount = s - 1;
    currentStepCount = s - lastTotalStepCount;
  });
}

function enableAccelSensor() {
  Bangle.on("accel", a => {
    accelSum += Math.abs(a.mag - 1);
    accelSamples++;
  });
}


// -----------------------------
// AGGREGATION HELPERS
// -----------------------------
function sendAggregatedData() {
   const ms = Date.now() - startTime;


   if (hrmBuffer.length > 0) {
     const avgBpm = hrmBuffer.reduce((s,v)=>s+v.bpm,0) / hrmBuffer.length;
     const avgConf = hrmBuffer.reduce((s,v)=>s+(v.confidence||0),0) / hrmBuffer.length;
     send(`AGG,HR,${ms},${avgBpm.toFixed(1)},${avgConf.toFixed(1)}`);
     hrmBuffer = [];
   }

  }

// ---------------- DATA COLLECTION ----------------

function startCollection() {
  if (isCollecting) return;

  isCollecting = true;
  Bangle.buzz(300);

  // Skapa/öppna fil (w = overwrite, sedan bara append med file.write)
  file = storage.open(settings.filename, "w");
  file.write("timestamp,steps,accel,hr,hr_confidence,battery\n");

  // Turn on chosen sensors
  if (settings.sensors.includes("steps")) enableStepSensor();
  if (settings.sensors.includes("accel")) enableAccelSensor();

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
  if (!isCollecting) return;

  isCollecting = false;

  if (logTimer) clearInterval(logTimer);
  if (hrTimer) clearInterval(hrTimer);

  logTimer = null;
  hrTimer = null;

  Bangle.removeAllListeners("step");
  Bangle.removeAllListeners("accel");
  stopHRM();

  if (file) {
    file = null; // handle stängs automatiskt
  }

  Bangle.buzz(200);
}

// Bluetooth commands - need some work, dont work as they should in espruino IDE
 Bluetooth.on("data", function(d) {
  if (!isStreaming) return;
   d.split("\n").forEach(cmd => {
     cmd = cmd.trim();
     if (!cmd) return;


     send("DEBUG: GOT CMD " + cmd);

     if (cmd === "HR_ON") startHRM();
     if (cmd === "HR_OFF") stopHRM();

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
       isCollecting = true;
       startTime = Date.now();
       send("DEBUG: TEST STARTED");
     }


     if (cmd === "STOP") {
       isCollecting = false;

       stopHRM();

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
     "": { title: "Mobistudy" },

     "Starta streaming": () => {
      isStreaming = true;
       E.showMessage("Streaming\nStyrs från webbapp");
     },

     "Logga på klockan": () => showLoggingMenu(),

     "Stoppa allt": () => {
       stopAll();
     },

     "Sensorer": () => showSensorList()
   });
 }

function showSensorList() {
  let menu = {
    "": { title: "Aktiva sensorer" },
    "< Tillbaka": () => showMainMenu()
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

 function showLoggingMenu(){
   E.showMenu({
     "": { title: "Logging" },
     "Välj sesnorer": () => showSensorList(),
     "Start": () => startCollection(),
     "Stop": () => stopCollection(),

     "< Tillbaka": () => showMainMenu()

   });
 }

showMainMenu();
