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
let accelBuffer = [];

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
   Bangle.on("step", onSTEP)
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


function onSTEP(s) {
   if (!isCollecting || !stepOn) return;

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
  }


function onACC(a) {
  // --- LOGGING MODE (file logging) ---
  if (isCollecting) {
    accelSum += Math.abs(a.mag - 1);
    accelSamples++;
  }

  // --- STREAMING MODE ---
  if (isStreaming && accelOn) {
    const ms = Date.now() - startTime;
    send(`DATA,ACC,${ms},${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`);
  }

  // --- AGGREGATED MODE ---
  if (isCollecting && accelOn) {
    accelBuffer.push(a);
  }
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
  if (!isCollecting) return;

  isCollecting = false;

  if (logTimer) clearInterval(logTimer);
  if (hrTimer) clearInterval(hrTimer);

  logTimer = null;
  hrTimer = null;

  stopSteps();
  stopAccel();
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

     if (cmd === "ACC_ON") startAccel();
     if (cmd === "ACC_OFF") stopAccel();

     if (cmd === "STEPS_ON") startSteps();
     if (cmd === "STEPS_OFF") stopSteps();

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
       stopAccel();
       stopSteps();

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

     "Start streaming": () => streamingMenu(),

     "Logg on the watch": () => showLoggingMenu(),

     "Stopp all": () => {
       stopCollection();
     },

     "Sensors": () => showSensorList()
   });
 }


function streamingMenu() {
  E.showMenu({
    "": { title: "Streaming" },

    "Starta streaming": () => {
      isStreaming = true;
      E.showMessage("Streaming startad");
    },

    "< Back": () => showMainMenu()
  });
}


function showSensorList() {
  let menu = {
    "": { title: "Active sensors" },
    "< Back": () => showMainMenu()
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
     "Choose sensors": () => showSensorList(),
     "Start": () => startCollection(),
     "Stop": () => stopCollection(),

     "< Back": () => showMainMenu()

   });
 }

showMainMenu();
 //Terminal.setConsole(true); // needs to be activated to test data streaming with webapp.
})();