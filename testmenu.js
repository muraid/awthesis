Bangle.loadWidgets();
Bangle.drawWidgets();   

const storage = require("Storage");

//code from innovation course 
const config = {
  filename: settings.filename || "mobistudy.bin",
  samplingPeriod: settings.interval, 
  bytesPerStepCount: 1
};
const bytesPerRow = 10;
const totalFileLen = 28800;

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
    gyroscope: true,
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
            onchange: () => showSensorMenu()
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

function showSensorMenu(){

}

function showTimedTestsMenu(){

}

function showEMAMenu(){

}

function startDataCollection(){
    Bangle.on("step", s => {
    if (lastTotalStepCount < 0) lastTotalStepCount = s - 1;
    currentStepCount = s - lastTotalStepCount;
    });


    Bangle.on("accel", a => {
    accelSum += Math.abs(a.mag - 1);
    accelSamples++;
    });


// ---- HEART RATE ----
function measureHR() {
    if (isMeasuring) return;


    isMeasuring = true;
    let samples = [];

 function onHRM(e) {
   if (e.confidence > 0 && e.bpm > 0) samples.push(e);
 }

    Bangle.on("HRM", onHRM);
    Bangle.setHRMPower(true);


    setTimeout(() => {
    Bangle.removeListener("HRM", onHRM);
    Bangle.setHRMPower(false);
    isMeasuring = false;


    if (samples.length === 0) {
        hr = 0;
        hrConfidence = 0;
        return;
    }

    let best = samples.reduce((a, b) =>
        (b.confidence > a.confidence ? b : a)
    );

    hr = best.bpm;
    hrConfidence = best.confidence;

    }, 20000);

    let ts = Math.round(Date.now() / 1000);

    let accelAvg = accelSamples ? (accelSum / accelSamples) : 0;
    let accelByte = Math.min(255, Math.round(accelAvg * 100));

    let batt = E.getBattery();   // NEW

    appendRow(ts, currentStepCount, accelByte, hr, hrConfidence, batt);

    // Reset values
    currentStepCount = 0;
    accelSum = 0;
    accelSamples = 0;


    measureHR();
 }
}


showStartMenu();
