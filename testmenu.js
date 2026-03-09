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

        "Timed tests": {
            onchange: () => showTimedTestsMenu()
        },
        "EMA": {
            onchange: () => showEMAMenu()
        }
    };
    E.showMenu(menu);
}


showStartMenu();
