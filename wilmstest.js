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
            onchange: () => showSensorsMenu()
        },
        "Settings": {
            onchange: () => showSettingsMenu()
        },
        "Participant": {
            onchange: () => showParticipantMenu()
        },
        "Timed tests": {
            onchange: () => showTimedTestsMenu()
        },
        "EMA": {
            onchange: () => showEMAMenu()
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
        "Vibration": { // change so we can control time and intensity of vibration
            value: settings.vibration,
            onchange: v => {
                settings.vibration = v; 
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
        "Gyroscope": {
            value: settings.gyroscope,
            onchange: v => {
                settings.gyroscope = v; 
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


function showSettingsMenu() {
    const menu = {
        "": { "title": "Sensors" },
        "< Back": function() { showStartMenu(); },

        "Bluetooth": { //turn off ability to connect bluetooth to unknown devices, only allow connection to phone app
            value: settings.bluetooth,
            onchange: v => {
                settings.bluetooth = v; 
                saveSettings();
            }
        },
        "Display": { //change display settings such as brightness and timeout
            value: settings.display,
            onchange: v => {    
                settings.display = v;
                saveSettings();
            }
        },
        "Sound": { //turn off sound and control volume
            value: settings.sound,
            onchange: v => {
                settings.sound = v; 
                saveSettings();
            }
        },
        "Firmware update": {
            value: settings.firmwareup,
            onchange: v => {
                settings.firmwareup = v; 
                saveSettings();
            }
        },
        "Reset settings": {
            value: settings.resetsettings,
            onchange: v => {
                settings.resetsettings = v; 
                saveSettings();
            }
        }
       
    };    
    E.showMenu(menu);
}

function showParticipantMenu() {
    const menu = {
        "": { "title": "Participant" },
        "< Back": function() { showStartMenu(); },  
        "ID": {
            value: settings.participantID || "",
            onchange: v => {
                settings.participantID = v;
                saveSettings();
            }
        },
        "Age": {
            value: settings.participantAge || "",
            onchange: v => {
                settings.participantAge = v;
                saveSettings();
            }
        },  
        "Gender": {
            value: settings.participantGender || "",
            onchange: v => {
                settings.participantGender = v;
                saveSettings();
            }
        },
        "Session": {
            value: settings.session || "",
            onchange: v => {
                settings.session = v;
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


showStartMenu();
 showSettingsMenu();