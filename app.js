(() => {
  Bangle.loadWidgets();
  Bangle.drawWidgets();

  // Init BLE
  require("ble.js").initBLE();

  // Initiera menyer
  const menus = require("menus.js");
  menus.showMainMenu();
})();
