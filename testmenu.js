Bangle.loadWidgets();
Bangle.drawWidgets();   

const storage = require("Storage");

let settings = storage.readJSON("mobistudy.json", 1) || {
    interval: 10,
    vibration: true,
    accelerometer: true,
    gyroscope: true
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
       
    };    E.showMenu(menu);
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
        }
    };
    E.showMenu(menu);
}
showStartMenu();
 showSettingsMenu();