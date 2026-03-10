Bangle.loadWidgets();
Bangle.drawWidgets();   

const storage = require("Storage");

//code from innovation course 
const config = {
  filename: settings.filename || "mobistudy.bin",
  samplingPeriod: settings.interval, 
  bytesPerStepCount: 1
};

let writtenRows = 0;
let lastTotalStepCount = -1;
let currentStepCount = 0;
let accelSum = 0;
let accelSamples = 0;
let hr = 0;
let hrConfidence = 0;
let isMeasuring = false;
//code from innovation course 


let settings = storage.readJSON("mobistudy.json", 1) || {
    interval: 10,
    vibration: true,
    accelerometer: true,
    heartRate: true,
    filename: "mobistudy_log.csv",
    continuous: false,
    sporadic: false
};

function saveSettings() {
    storage.writeJSON("mobistudy.json", settings);
}

function showStartMenu() {
    const menu = {
        "": { "title": "Start Menu" },
        "< Back": () => load(),

        "Sensors": {
            onchange: () => showSensorsMenu()
        },
        "Timed tests": {
            onchange: () => showTimedTestsMenu()
        },
        "EMA": {
            onchange: () => showEMAMenu()
        },
        "Start": {
             onchange: () => startDataCollection()
        }
    };
    E.showMenu(menu);
}

function showSensorsMenu() {
    const menu = {
        "": { "title": "Sensors" },
        "< Back": function() { showStartMenu(); },

        "Interval (s)": {
            value: settings.interval,
            min: 1,
            max: 60,
            step: 1,
            onchange: v => {
                settings.interval = v;
                saveSettings();
            }
        },
        "Accelerometer": {
            value: settings.accelerometer,
            onchange: v => {
                settings.accelerometer = v; 
                saveSettings();
            }
        },
        "Heart Rate": {
            value: settings.heartRate,
            onchange: v => {
                settings.heartRate = v; 
                saveSettings();
            }
        },
        "Filename": {
            value: settings.filename,
            onchange: v => {
                settings.filename = v;
                saveSettings();
            }   
        },
         "Type of data collection": {
            onchange: () => dataCollectionType()
        }

    };
    E.showMenu(menu);
}


function dataCollectionType() {
    const menu = {
        "": { "title": "Type of data collection" },
        "< Back": function() { showSensorsMenu(); },

    "Continuous": {
            value: settings.continuous,
            onchange: v => {
                settings.continuous = v;
                saveSettings();
            }
    },
    "Sporadic": {
        value: settings.sporadic,
        onchange: v => {
            settings.sporadic = v;
            saveSettings();
        }
    }

    };
    E.showMenu(menu);
}


function showTimedTestsMenu() {
    const menu = {
        "": { "title": "Timed tests" },
        "< Back": function() { showStartMenu(); }, 

        "6MWT": {
            value: settings.walkingtest,
            onchange: v => {
                settings.walkingtest = v; 
                saveSettings();
            }
        },
        "Timed up and go": {
            value: settings.upandgo,
            onchange: v => {
                settings.upandgo = v; 
                saveSettings();
            }
        }
    };
    E.showMenu(menu);
}

function showEMAMenu() {
    const menu = {
        "": { "title": "EMA" },
        "< Back": function() { showStartMenu(); },

    };
    E.showMenu(menu);

}

function startDataCollection() {
  const menu = {
    "": { "title": "Timed tests" },
    "< Back": function() { showStartMenu(); },

    "RECORD": {
      value: !!settings.recording,
      onchange: v => {
        setTimeout(function() {
          E.showMenu(); // rensa menyn visuellt
          require("recorder").setRecording(v).then(function() {
            loadSettings();
            startDataCollection(); // visa denna meny igen
          });
        }, 1);
      }
    }
  };

  E.showMenu(menu);
}

// ---------------- HEART RATE ----------------

function measureHR() {
  if (isMeasuringHR) return;

  isMeasuringHR = true;
  let samples = [];

  function onHRM(e) {
    if (e.confidence > 0 && e.bpm > 0) samples.push(e);
  }

  Bangle.on("HRM", onHRM);
  Bangle.setHRMPower(true);

  setTimeout(() => {
    Bangle.removeListener("HRM", onHRM);
    Bangle.setHRMPower(false);
    isMeasuringHR = false;

    if (samples.length === 0) {
      hr = 0;
      hrConfidence = 0;
    } else {
      let best = samples.reduce((a, b) =>
        b.confidence > a.confidence ? b : a
      );
      hr = best.bpm;
      hrConfidence = best.confidence;
    }

  }, 20000);
}

// ---------------- DATA COLLECTION ----------------
function startSensors() {
  // STEP COUNTER
  Bangle.on("step", s => {
    if (lastTotalStepCount < 0) lastTotalStepCount = s - 1;
    currentStepCount = s - lastTotalStepCount;
  });

  // ACCELEROMETER
  Bangle.on("accel", a => {
    accelSum += Math.abs(a.mag - 1);
    accelSamples++;
  });
}

function stopSensors() {
  Bangle.removeAllListeners("step");
  Bangle.removeAllListeners("accel");
}

function startLogging() {
  if (dataTimer) clearInterval(dataTimer);

  dataTimer = setInterval(() => {
    let ts = Math.round(Date.now() / 1000);

    let accelAvg = accelSamples ? (accelSum / accelSamples) : 0;
    let accelByte = Math.min(255, Math.round(accelAvg * 100));

    let batt = E.getBattery();

    appendRow(ts, currentStepCount, accelByte, hr, hrConfidence, batt);

    // reset
    currentStepCount = 0;
    accelSum = 0;
    accelSamples = 0;

    // trigger HR measurement
    if (settings.heartRate) measureHR();

  }, settings.interval * 1000);
}

function stopLogging() {
  if (dataTimer) clearInterval(dataTimer);
  dataTimer = undefined;
}

function startDataCollection() {

  const menu = {
    "": { "title": "Timed tests" },
    "< Back": () => { 
      stopLogging();
      stopSensors();
      showStartMenu(); 
    },

    "RECORD": {
      value: !!settings.recording,
      onchange: v => {
        settings.recording = v;

        if (v) {
          // Start
          startSensors();
          startLogging();
        } else {
          // Stop
          stopLogging();
          stopSensors();
        }

        // Update recorder module
        setTimeout(() => {
          E.showMenu();
          require("recorder").setRecording(v).then(() => {
            loadSettings();
            startDataCollection();
          });
        }, 1);
      }
    }
  };

  E.showMenu(menu);
}




showStartMenu();
 showSettingsMenu();