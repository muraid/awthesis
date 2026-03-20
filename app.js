/* ============================================================
   BANGLE.JS APP – STRUKTUR-SKELETT (EN FIL)
   ============================================================ */

/* ============================================================
   Modul: SensorManager
   Ansvar:
   - Slå på/av sensorer
   - Lyssna på Bangle.on(...) events
   - Skicka data till Logger och BLE
   ============================================================ */
const SensorManager = (() => {

  let activeSensors = [];
  let callbacks = {
    onHRM : null,
    onAccel : null,
    onStep : null,
    onMag : null,
    onPressure : null,
    onGPS : null,
  };

  function start(sensorList) {
    activeSensors = sensorList;

    // TODO: enable sensors based on sensorList
    // e.g. if (sensorList.includes("hr")) Bangle.setHRMPower(true);

    // TODO: attach Bangle.on(...) listeners
    // Call callbacks.* whenever data arrives
  }

  function stop() {
    // TODO: disable sensors
    // TODO: remove listeners
  }

  function on(eventName, fn) {
    callbacks[eventName] = fn;
  }

  return { start, stop, on };

})();



/* ============================================================
   Modul: LocalLogger
   Ansvar:
   - Filskrivning
   - Period-timer för CSV
   ============================================================ */
const LocalLogger = (() => {

  let file = null;
  let interval = 10;
  let timer = null;
  let enabledSensors = [];

  function startLogging(filename, intervalSec, sensors) {
    interval = intervalSec;
    enabledSensors = sensors;

    // TODO: open file, write header

    timer = setInterval(() => {
      // TODO: gather cached sensor data
      // TODO: write CSV row
    }, interval * 1000);
  }

  function stopLogging() {
    if (timer) clearInterval(timer);
    timer = null;
    // TODO: close file handle
  }

  function onSensorData(type, data) {
    // TODO: store for next CSV row
  }

  return { startLogging, stopLogging, onSensorData };

})();



/* ============================================================
   Modul: BLEManager
   Ansvar:
   - Streama data (endast när ansluten + streamEnabled)
   - Ta emot BLE-kommandon
   - Styra SensorManager (om allowControl = true)
   ============================================================ */
const BLEManager = (() => {

  let streamEnabled = false;
  let allowControl = false;
  let aggPeriod = 0;
  let connected = false;

  // TODO: buffers for aggregation

  function init() {
    NRF.on('connect', ()=> { connected=true; });
    NRF.on('disconnect', ()=> { connected=false; });

    Bluetooth.on("data", raw => {
      // TODO: parse BLE commands
      // if allowControl = true → manipulate SensorManager or settings
    });
  }

  function send(line) {
    if (!streamEnabled) return;
    if (!connected) return;
    try { Bluetooth.println(line); } catch(e){}
  }

  function enableStreaming(v) { streamEnabled = v; }
  function enableControl(v) { allowControl = v; }

  function setAggPeriod(ms) {
    aggPeriod = ms;
    // TODO: start/stop agg timer
  }

  function onSensorData(type, data) {
    // TODO: if aggPeriod==0 → send DATA now
    // TODO: if aggPeriod>0 → push to buffer
  }

  return {
    init, send,
    enableStreaming, enableControl,
    setAggPeriod,
    onSensorData
  };

})();



/* ============================================================
   Modul: UI (menyer)
   Ansvar:
   - Användarinteraktion
   - Start/stop lokal loggning
   - Start/stop sensorer
   - Konfigurera BLEManager
   ============================================================ */
const UI = (() => {

  let config = {
    sensors: ["steps","accel","hr"],
    interval: 10,
    filename: "log.csv"
  };

  function showMainMenu() {
    E.showMenu({
      "": { title:"DataApp" },
      "Start" : ()=> start(),
      "Stop" : ()=> stop(),
      "Sensorer" : ()=> showSensorMenu(),
      "BLE" : ()=> showBleMenu(),
      "Inställningar" : ()=> showSettingsMenu()
    });
  }

  function start() {
    SensorManager.start(config.sensors);
    LocalLogger.startLogging(config.filename, config.interval, config.sensors);
    BLEManager.setAggPeriod(0); // default
  }

  function stop() {
    SensorManager.stop();
    LocalLogger.stopLogging();
  }

  function showSensorMenu() {
    // TODO: menu to turn sensors on/off
  }

  function showBleMenu() {
    // TODO: menu for:
    // - enableStreaming
    // - allowControl
    // - aggPeriod settings
  }

  function showSettingsMenu() {
    // TODO: change filename, interval etc.
  }

  return { showMainMenu };

})();



/* ============================================================
   APP MAIN START
   ============================================================ */

Bangle.loadWidgets();
Bangle.drawWidgets();

BLEManager.init();
UI.showMainMenu();