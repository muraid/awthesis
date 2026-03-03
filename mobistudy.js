Bangle.loadWidgets();
Bangle.drawWidgets();   

const storage = require("Storage");

let settings = storage.readJSON("mobistudy.json", 1) || {
    interval: 10,
    vibration: true,
    accelerometer: true
};

function saveSettings() {
    storage.writeJSON("mobistudy.json", settings);
}

function showSettingsMenu() {
    const menu = {
        "": { "title": "MobiStudy Settings" },
        "< Back": () => load(),

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
        "Vibration": {
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
        }

    };
    E.showMenu(menu);
}

showSettingsMenu();