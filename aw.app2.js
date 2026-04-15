(() => {
  //Bluetooth.setConsole(false);
  Bangle.loadWidgets();

  let maxIndex = 768;

  let awapp= E.compiledC(`
  // void initArray(int, int)
  // void clear()
  // void writeIDs()
  // void setHRM(bool)
  // void setBarometer(bool)
  // void setAccelerometer(bool)
  // void setMagnetude(bool)
  // void setCompass(bool)
  // void setGPS(bool)
  // bool writeIDsToArray()
  // bool writeOptions1(bool, bool, bool)
  // bool writeOptions2(bool, bool, bool)
  // bool writeDate(int, int, int)
  // bool writeTime(int, int)
  // bool writeBarometer(int, int, int, int)
  // bool writeHRM(int, int)
  // bool writeAccelerometer(int,int,int,int)
  // bool writeMagnetude(int, int)
  // void compassData(int, int, int)
  // bool writeCompass(int, int)
  // bool writeGPS(int, int, int, int)
  // void writeToArray()
  // void writeBit(bool)
  // void writeNBits(int,int)
  // void writeByte(int)
  // void writePreamble(int, int)
  // void writeDouble(int)
  // bool hitLimit()
  // int getIndex()
  // int writeEndID(int)


  /***
  Local variables
  ***/
  //writeBuffer and the index
  unsigned char byteWrite = 0;
  unsigned char byteIndex = 0;

  //save Compass data, because Espurino only allows 4 arguments
  int xCompass = 0;
  int yCompass = 0;
  int zCompass = 0;

  //Array and information
  unsigned char* array;
  int index = 0;
  int maxIndex = 0;

  unsigned char overflowArray[30];
  int indexOverflow = 0;

  //Local ID encoding 
  char localIDLength = 0;
  char localHRMID = 0;
  char localBarometerID = 0;
  char localAccelID = 0;
  char localMagnetudeID = 0;
  char localCompassID = 0;
  char localGPSID = 0;

  //is sensor used?
  bool localHRMUse = 0;
  bool localBarometerUse = 0;
  bool localAccelUse = 0;
  bool localMagnetudeUse = 0;
  bool localCompassUse = 0;
  bool localGPSUse = 0;

  //options if the height from barometer should be saved or calculated later
  bool saveHeight = false;

  /***
  This function sets up all the nessesery data for the module.

  This function sets the pointer to the write array. This pointer is recived from the JS side.
  Additionaly the maximum Index needs to be set.

  For the module to work properly this initArray function must be called first!
  ***/
  void initArray(unsigned char *arrayPointer, int dataMaxIndex){
    array = arrayPointer;
    maxIndex = dataMaxIndex;
  }

  /***
  This function writes the data from the writeBuffer to the Array.

  This function writes the data from the writeBuffer to the Array, while resetting all associated variables. 
  If the writeBuffer is bigger than 254 the last bit will be read out of the writeBuffer and replaced with a 0.
  The leftover bit will then be inserted again in the writeBuffer.
  This is done because the value 255 shouldnt be written to the file. As this indecates erased flash memory.
  https://www.espruino.com/ReferenceBANGLEJS2#t_StorageFile

  ***/
  void writeToArray(){
    if(index < maxIndex){
      if(byteWrite <254){
        array[index] = byteWrite;
        index++;  
        byteWrite = 0;
        byteIndex = 0;
      }
      else{
        bool lastBit = byteWrite & 1;
        array[index] = byteWrite & 254;
        index++;
        byteWrite = lastBit;
        byteWrite = byteWrite << 1;
        byteIndex = 1;
      }
    }
    else{
      // else write to overflow
      if(byteWrite < 254){
        overflowArray[indexOverflow] = byteWrite;
        indexOverflow++;  
        byteWrite = 0;
        byteIndex = 0;
      }
      else{
        bool lastBit = byteWrite & 1;
        overflowArray[indexOverflow] = byteWrite & 254;
        indexOverflow++;
        byteWrite = lastBit;
        byteWrite = byteWrite << 1;
        byteIndex = 1;
      }
    }

  }

  /***
  This function checks if the current index is bigger than the max Index.
  This indecates that the array needs to be written to the file.
  ***/
  bool hitLimit(){
    if(index == maxIndex){
      return true;
    }  
    else
    {
      return false;
    }
  }

  /***
  This function writes a single bit to the writeBuffer.
  If the writeBuffer is full then write the writeBuffer to the array, otherwise left shift the array by one.
  ***/
  void writeBit(bool toWrite){
    byteWrite = byteWrite | toWrite;
    byteIndex ++;
    if (byteIndex == 8) {
          writeToArray();
      }
      else{

          byteWrite = byteWrite << 1;
      }
  }

  /***
  This function writes multiple bits to the writeBuffer.

  This function first shifts the data to the left, so that the bits are all left aligned.
  After that the MSB bit will be read and written to the writeBuffer,
  the data then will be shifted to the left. This is repeated numberOfBit times.
  ***/
  void writeNBits(unsigned char writeData, int numberOfBits){
    for(int i = numberOfBits ; i<8;i++){
          writeData = writeData << 1;
      }

    for (int i = 0; i < numberOfBits; i++) {
          bool bitToWrite = writeData & 128;
          writeBit(bitToWrite);
          writeData = writeData << 1;
      }
  }
  /***
  This function writes a byte to the writeBuffer.
  Starting from the MSB bit.
  ***/
  void writeByte(unsigned char writeData){

    for (int i = 0; i < 8; i++) {
          bool bitToWrite = writeData & 128;
          writeBit(bitToWrite);
          writeData = writeData << 1;
      }
  }

  /***
  This function writes the preamble for the data.
  The preamble contains of the localID as well as the deltatime between the each timestamp.
  ***/
  void writePreamble(unsigned char id, int deltatime){
      writeNBits(id, localIDLength);
    if(deltatime < 255){
      writeBit(false);
      char dt = char(deltatime);
      writeByte(dt);
    }else{
      writeBit(true);
      unsigned char byte0 = deltatime & 0xFF;
      deltatime = deltatime >> 8;
      unsigned char byte1 = deltatime & 0xFF;
      deltatime = deltatime >> 8;
      unsigned char byte2 = deltatime & 0xFF;
      deltatime = deltatime >> 8;
      unsigned char byte3 = deltatime & 0xFF;
      writeByte(byte3);
      writeByte(byte2);
      writeByte(byte1);
      writeByte(byte0);
    }
  }

  /***
  This function writes a double value to the writeBuffer.
  ***/
  void writeDouble(unsigned char* doubleVal){

    for(int i = 0; i < 8; i++){
      writeByte(doubleVal[i]);
    }
  }

  /***
  This function writes clears the index because the array has been saved to a file.
  ***/
  void clear(){
    index = 0;

    for(; index < indexOverflow; index++){
      array[index] = overflowArray[index];
    }
    indexOverflow = 0;

  }

  /***
  These functions mark if the will be written to a file.
  ***/
  void setHRM(bool state){
    localHRMUse = state;
  }
  void setBarometer(bool state){
    localBarometerUse = state;
  }
  void setAccelerometer(bool state){
    localAccelUse = state;
  }
  void setMagnetude(bool state){
    localMagnetudeUse = state;
  }
  void setCompass(bool state){
    localCompassUse = state;
  }
  void setGPS(bool state){
    localGPSUse = state;
  }

  /***
  This function checks if the given Sensor should be used and it gives a localID to the Sensor.
  The localID calculation ensures that the ID field is only as long as needed. 
  ***/
  void writeIDs(){
    char id = 0;
    if(localHRMUse == 1){
      localHRMID = id;
      id++;
    }
    if(localBarometerUse == 1){
      localBarometerID = id;
      id++;
    }
    if(localAccelUse == 1){
      localAccelID = id;
      id++;
    }
    if(localMagnetudeUse == 1){
      localMagnetudeID = id;
      id++;
    }
    if(localCompassUse == 1){
      localCompassID = id;
      id++;
    }
    if(localGPSUse == 1){
      localGPSID = id;
      id++;
    }

    while (id > 0) {
          localIDLength++;
          id >>= 1;
    }
  }

  /***
  This function writes all localIDs with the globalIDs to the file.
  This is needed for the decoding to remap all sensors.

  It returns if the array is full.
  ***/
  bool writeIDsToArray(){
    writeIDs();
    writeByte(localIDLength);
    if(localHRMUse != 0){
      writeNBits(localHRMID, localIDLength);
    writeByte(1);
    }
    if(localBarometerUse != 0){
      writeNBits(localBarometerID, localIDLength);
    writeByte(2);
    }
    if(localAccelUse != 0){
      writeNBits(localAccelID, localIDLength);
    writeByte(3);
    }
    if(localMagnetudeUse != 0){
      writeNBits(localMagnetudeID, localIDLength);
    writeByte(4);
    }
    if(localCompassUse != 0){
      writeNBits(localCompassID, localIDLength);
    writeByte(5);
    }
    if(localGPSUse != 0){
      writeNBits(localGPSID, localIDLength);
    writeByte(6);
    }

    writeNBits(255, localIDLength);

    if(index >= maxIndex-1){
      return true;
    }  
    else
    {
      return false;
    }
  }

  /***
  This function writes the options for decoding.
  It indicates if the height should be saved or calculated later.
  Select if the decoder should use JSMath or more accurate version.
  It determents the output format of the decoder (XML or CSV). 

  It returns if the array is full.
  ***/
  bool writeOptions1(bool saveHeight_,bool jsMath, bool saveXML){
    saveHeight = saveHeight_;
    writeBit(saveHeight);
  writeBit(jsMath);
    writeBit(saveXML);

    if(index >= maxIndex-1){
      return true;
    }  
    else
    {
      return false;
    }
  }
  
  /***
  This function writes the options for decoding.
  Indicates how the outputfile should be named.

  It returns if the array is full.
  ***/
  bool writeOptions2(bool filenameSupervisor,bool filenameSubject, bool filenameDate){
    writeBit(filenameSupervisor);
    writeBit(filenameSubject);
    writeBit(filenameDate);

    if(index >= maxIndex-1){
      return true;
    }  
    else
    {
      return false;
    }
  }


  /***
  This function writes the current Date to the file.

  It returns if the array is full.
  ***/
  bool writeDate(int year, int month, int day){

    char numberOfBitsYear = 0;
    int yearCopy = year;

    while (yearCopy > 0) {
      numberOfBitsYear++;
      yearCopy >>= 1;
    }

    writeByte(numberOfBitsYear);
      bool write = false;
      for(int i = 0; i < numberOfBitsYear; i++){
      write = year & 1;
      writeBit(write);
      year = year >> 1;
    }

    writeNBits(month, 4);
    writeNBits(day -1, 5);

    return hitLimit();
  }


  /***
  This function writes the current time to the file.

  It returns if the array is full.
  ***/
  bool writeTime(char hours, char minutes){
    writeNBits(hours, 5);
    writeNBits(minutes , 6);
    return hitLimit();
  }

  /***
  This function writes the barometer values to the file.

  if saveHeight was turned on the height will be saved as well.

  It returns if the array is full.
  ***/
  bool writeBarometer(unsigned char* temperature, unsigned char* pressure, unsigned char* height, int deltatime){

    writePreamble(localBarometerID, deltatime);

    // finde exponent heraus

    writeDouble(temperature);
    writeDouble(pressure);

    if(saveHeight){
      writeDouble(height);
    }


    return hitLimit();
  }  

  /***
  This function writes the ppg value to the file.

  It returns if the array is full.
  ***/
  bool writeHRM(int ppg, int deltatime){
    unsigned char ppgLower = ppg & 255;
    ppg = ppg >> 8;
    unsigned char ppgUpper = ppg & 15;

    writePreamble(localHRMID, deltatime);
    writeNBits(ppgUpper, 4);
    writeByte(ppgLower);

    return hitLimit();
  }

  /***
  This function writes xyz-accelerometer data to the file.

  The values first need to be converted to int16 by multiplying the JS values with 8192.0.
  This reverses the division which was done by Espurino.

  It returns if the array is full.
  ***/
  bool writeAccelerometer(int xAccelerometer,int yAccelerometer,int zAccelerometer, int deltatime){

    writePreamble(localAccelID, deltatime);

    writeBit(xAccelerometer>=0);

    if(xAccelerometer<0){
      xAccelerometer = -xAccelerometer;
    }

    unsigned char lowerByte = xAccelerometer & 255;
    xAccelerometer = xAccelerometer >> 8;
    unsigned char upperByte = xAccelerometer & 255;
    writeByte(upperByte);
    writeByte(lowerByte);

    writeBit(yAccelerometer>=0);

    if(yAccelerometer<0){
      yAccelerometer = -yAccelerometer;
    }

    lowerByte = yAccelerometer & 255;
    yAccelerometer = yAccelerometer >> 8;
    upperByte = yAccelerometer & 255;
    writeByte(upperByte);
    writeByte(lowerByte);

    writeBit(zAccelerometer>=0);

    if(zAccelerometer<0){
      zAccelerometer = -zAccelerometer;
    }

    lowerByte = zAccelerometer & 255;
    zAccelerometer = zAccelerometer >> 8;
    upperByte = zAccelerometer & 255;
    writeByte(upperByte);
    writeByte(lowerByte);

    return hitLimit();
  }

  /***
  This function writes the magnetude data to the file.

  The value first need to be converted to int16 by multiplying the JS values with 8192.0.
  This reverses the division which was done by Espurino.

  It returns if the array is full.
  ***/
  bool writeMagnetude(int magnetude, int deltatime){

    writePreamble(localMagnetudeID, deltatime);

    writeBit(magnetude>=0);

    if(magnetude<0){
      magnetude = -magnetude;
    }

    unsigned char lowerByte = magnetude & 255;
    magnetude = magnetude >> 8;
    unsigned char upperByte = magnetude & 255;
    writeByte(upperByte);
    writeByte(lowerByte);

    return hitLimit();
  }

  /***
  This function writes the xyz-compass data to local variables.

  This is done because only 4 arguments are allowd by the inline C compiler.
  Making 2 function calles instead of writing the xyz-values to predetermend JS-Array saves 1 ms.
  ***/
  void compassData(int x,int y,int z){
    xCompass = x;
    yCompass = y;
    zCompass = z;
  }

  /***
  This function writes the compass data to the file.

  The xyz-values of the compass are written by the compassData function.

  It returns if the array is full.
  ***/
  bool writeCompass(unsigned char* heading, int deltatime){
    writePreamble(localCompassID, deltatime);


    writeBit(xCompass>=0);
    if(xCompass<0){
      xCompass = -xCompass;
    }

    unsigned char lowerByte = xCompass & 255;
    xCompass = xCompass >> 8;
    unsigned char upperByte = xCompass & 15;
    writeNBits(upperByte, 4);
    writeByte(lowerByte);

    writeBit(yCompass>=0);
    if(yCompass<0){
      yCompass = -yCompass;
    }

    lowerByte = yCompass & 255;
    yCompass = yCompass >> 8;
    upperByte = yCompass & 15;
    writeNBits(upperByte, 4);
    writeByte(lowerByte);

    writeBit(zCompass>=0);
    if(zCompass<0){
      zCompass = -zCompass;
    }

    lowerByte = zCompass & 255;
    zCompass = zCompass >> 8;
    upperByte = zCompass & 15;
    writeNBits(upperByte, 4);
    writeByte(lowerByte);

    writeDouble(heading);

    return hitLimit();  
  }

  /***
  This function writes the xyz-Coordinates from the GPS data to the file.

  It returns if the array is full.
  ***/
  bool writeGPS(unsigned char* xGPS,unsigned char* yGPS,unsigned char* zGPS,int deltatime){
    writePreamble(localGPSID,deltatime);

    writeDouble(xGPS);
    writeDouble(yGPS);
    writeDouble(zGPS);

    return hitLimit();
  }

  /***
  This function returns the current index of the array.
  ***/
  int getIndex(){
    return index;
  }

  int writeEndID(int deltatime){
    writePreamble(localAccelID, deltatime);
    writeByte(255);
    
    if(indexOverflow == 0){
      return false;
    }
    else{
      return true;
    }
  }
`);

let writeBuffer = new ArrayBuffer(0);
let writeBufferDataView = new DataView(writeBuffer);
let writeBufferAddr = E.getAddressOf(writeBuffer,true);
awapp.initArray(writeBufferAddr, maxIndex);

  const storage = require("Storage");

  // ---------------- SETTINGS ----------------

  let settings = {
    sensors: ["steps", "accel", "hr", "temp"], // default
    interval: 10, // seconds
    emaEnabled: false,
    emaInterval: 3600, // seconds (1 hour default)
    rawMode: false,
    ramSize: 50
  };

  const config = {
    filename: "collectedData.bin",
    bytesPerStepCount: 1,
    appendPos: 0
  };

  // 4 bytes timestamp + 1 step + 1 accel + 1 HR + 1 conf + 1 battery + 1 temp + 1 padding = 11 bytes per row
  const RAW_FILE_LEN = 60000;
  const AGG_FILE_LEN = 20000;


  let rows = [];

  // ---------------- STREAMING STATE ----------------
  let hrmOn = false;
  let accelOn = false;
  let stepOn = false;
  let magOn = false;
  let pressureOn = false;
  let tempOn = false;
  let gpsOn = false;
  let streamStepTimer = null;

  // ---------------- STATE ----------------
  let startTime = 0;
  let isAggregated = false; // logging mode
  let isStreaming = false;
  let logTimer = null;
  let hrTimer = null;

  let lastStepStream = -1;
  let lastStepAgg = -1;
  let currentStepCount = 0;

  let lastTimestampAcc = 0;
  let lastTimestampMag = 0;
  let lastTimestampBaro = 0;
  let lastTimestampGPS = 0;

  let lastTimestampHRM = 0;

  let accelSum = 0;
  let accelSamples = 0;

  let tempSum = 0;
  let tempSamples = 0;

  let hr = 0;
  let hrConfidence = 0;

  // HR buffer för "bästa 20s"
  let hrmBuffer = [];

  // barometer shared state (temp + pressure)
  let baroOn = false;
  
  // EMA variables
  let emaON = false;
  let emaTimer = null;

  // 6MWT Countdown 
  let sixMWTInterval;
  let sixMWTSeconds = 360; // 6 minutes

//function to send messages
  function send(line) {
    Bluetooth.println(line);
  }

  // ---------------- FILE LOGGING ----------------

  function saveData(ramData) {
  var l = ramData.length;
  if(file.offset == 0){
    storage.write(file.name,ramData,0,FILESIZE);
    file.offset = l;
    print("create File");
  }
  else{
  // just append
    if(file.offset+l < FILESIZE){
      storage.write(file.name,ramData,file.offset);
      file.offset += l;
    }
    else{
      let leftSpace = FILESIZE - file.offset;
      
      let tempBuffer = new ArrayBuffer(leftSpace);
      let tempBufferDataView = new DataView(tempBuffer);
      
      for (let i = 0; i < leftSpace; i++) {
        let valueToWrite = writeBufferDataView.getInt8(i);
        tempBufferDataView.setInt8(i,valueToWrite);
      }
      
      storage.write(file.name,tempBufferDataView.buffer,file.offset);
      file.offset += l + 100000;
    }
  }
}

function writeToFlash(){
  if(file.offset < FILESIZE){
    saveData(writeBuffer);
  }

  awapp.clear();
  if(file.offset >= FILESIZE){
    fullStorage();
    Bangle.buzz();
    Bangle.buzz();
    Bangle.buzz();
  }
}


let tempB = new ArrayBuffer(8);
let tempBDataView = new DataView(tempB);
let tempBAddr = E.getAddressOf(tempBDataView.buffer,true);

let pressB = new ArrayBuffer(8);
let pressBDataView = new DataView(pressB);
let pressBAddr = E.getAddressOf(pressBDataView.buffer,true);

let pressAltB = new ArrayBuffer(8);
let pressAltBDataView = new DataView(pressAltB);
let pressAltBAddr = E.getAddressOf(pressAltBDataView.buffer,true);

let compassB = new ArrayBuffer(8);
let compassBDataView = new DataView(compassB);
let compassBAddr = E.getAddressOf(compassBDataView.buffer,true);

let latB = new ArrayBuffer(8);
let latBDataView = new DataView(latB);
let latBAddr = E.getAddressOf(latBDataView.buffer,true);

let longB = new ArrayBuffer(8);
let longBDataView = new DataView(longB);
let longBAddr = E.getAddressOf(longBDataView.buffer,true);

let altB = new ArrayBuffer(8);
let altBDataView = new DataView(altB);
let altBAddr = E.getAddressOf(altBDataView.buffer,true);

let FILESIZE = 0;


function appendEventRow(code) {
  let rowSize = settings.rawMode ? 20 : 9;
  let row = new Uint8Array(rowSize);

  let ts = Math.round(Date.now() / 1000);
  let timestampBytes = numToBytes(ts, 4); //denna kan tas bort eftersom att vi inte har kvar little endian
  row.set(timestampBytes, 0);

  row[4] = code; // event code

  rows.push(row);
}

  // ---------------- SENSOR START/STOP ----------------

  function startHRM() {
    if (hrmOn) return;
    hrmOn = true;
    Bangle.setHRMPower(1);
    awapp.setHRM(true);
    send("DEBUG: HRM STARTED");
  }

  function stopHRM() {
    if (!hrmOn) return;
    hrmOn = false;
    Bangle.removeListener("HRM", onHRM);
    Bangle.setHRMPower(0);
    send("DEBUG: HRM STOPPED");
  }

  function startAccel() {
    if (accelOn) return;
    accelOn = true;
    Bangle.getAccel(1);
    awapp.setAccelerometer(true);
    send("DEBUG: ACCEL STARTED");
  }

  function stopAccel() {
    if (!accelOn) return;
    accelOn = false;
    Bangle.removeListener("accel", onACC);
    Bangle.getAccel(0);
    send("DEBUG: ACCEL STOPPED");
  }

  function startSteps() {
    if (stepOn) return;
    stepOn = true;
    lastStepStream = -1;
    lastStepAgg = -1;
    currentStepCount = 0;
    send("DEBUG: STEPS STARTED");
  }

  function stopSteps() {
    if (!stepOn) return;
    stepOn = false;
    Bangle.removeListener("step", onSTEP);
    lastStepStream = -1;
    lastStepAgg = -1;
    currentStepCount = 0;
    send("DEBUG: STEPS STOPPED");
  }

  function startMag() {
    if (magOn) return;
    magOn = true;
    Bangle.setCompassPower(true);
    awapp.setMagnetude(true);
    send("DEBUG: MAG STARTED");
  }

  function stopMag() {
    if (!magOn) return;
    magOn = false;
    Bangle.setCompassPower(false);
    send("DEBUG: MAG STOPPED");
  }

  //for raw logging
  function startPressure() {
    if (pressureOn) return;
    pressureOn = true;
    ensureBaroOn();
    awapp.setBarometer(true);
    send("DEBUG: PRESSURE STARTED");
  }

  function stopPressure() {
    if (!pressureOn) return;
    pressureOn = false;
    maybeBaroOff();
    send("DEBUG: PRESSURE STOPPED");
  }

  function startTemp() {
    if (tempOn) return;
    tempOn = true;
    ensureBaroOn();
    awapp.setBarometer(true);
    send("DEBUG: TEMP STARTED");
  }

  function stopTemp() {
    if (!tempOn) return;
    tempOn = false;
    maybeBaroOff();
    send("DEBUG: TEMP STOPPED");
  }

  function startGps() {
    if (gpsOn) return;
    gpsOn = true;
    Bangle.setGPSPower(true);
    awapp.setGPS(true);
    send("DEBUG: GPS STARTED");
  }

  function stopGps() {
    if (!gpsOn) return;
    gpsOn = false;
    Bangle.setGPSPower(false);
    send("DEBUG: GPS STOPPED");
  }

  //starts barometer if temp or pressure is turned on, since they share the same sensor
  function ensureBaroOn() {
    if (!baroOn) {
      baroOn = true;
      Bangle.setBarometerPower(true);
    }
  }

  //stops barometer if temp and pressure are turned off
  function maybeBaroOff() {
    if (!tempOn && !pressureOn && baroOn) {
      baroOn = false;
      Bangle.setBarometerPower(false);
    }
  }

  // ---------------- SENSOR HANDLERS ----------------

  function onHRM(d) {
    // STREAMING
    if (isStreaming) {
      const ms = Date.now() - startTime;
      send(`DATA,HR,${ms},${d.bpm},${d.confidence || 0}`);
    }
    // AGGREGATED: buffra för "bästa 20s"
    if (isAggregated && hrmBuffer && d.confidence > 0 && d.bpm > 0) {
      hrmBuffer.push(d);
    }
    if (settings.rawMode) {
    hr = d.bpm;
    hrConfidence = d.confidence;
    }

   // ================= RAW (C logging) =================
    if (settings.rawMode && d.confidence > 50) {

      let ppg = d.vcPPG !== undefined ? d.vcPPG : d.bpm;

      if (ppg > 0) {

        let now = Date.now();
        let deltaTime = lastTimestampHRM ? (now - lastTimestampHRM) : 0;
        lastTimestampHRM = now;

        awapp.writeHRM(ppg, deltaTime);
      }
    }
  }

  // HR-mätning: bästa HR under senaste 20 sek
  function measureHR() {
    if (hrmBuffer.length === 0) {
      hr = 0;
      hrConfidence = 0;
    } else {
      let best = hrmBuffer.reduce((a, b) =>
        (b.confidence || 0) > (a.confidence || 0) ? b : a
      );
      hr = best.bpm;
      hrConfidence = best.confidence || 0;
    }
    hrmBuffer = [];
  }

  function onSTEP(s) {
  // --- LOGGING (aggregated) ---
  if (isAggregated && stepOn) {
    if (lastStepAgg < 0) {
      lastStepAgg = s;
      return;
    }
    const diff = s - lastStepAgg;
    if (diff >= 0) currentStepCount += diff;
    lastStepAgg = s;
  }

  // --- STREAMING (räkna steg även om vi inte skickar direkt) ---
  if (isStreaming && stepOn) {
    if (lastStepStream < 0) {
      lastStepStream = s;
      return;
    }
    const diff = s - lastStepStream;
    if (diff >= 0) currentStepCount += diff;
    lastStepStream = s;
  }
  if (isStreaming && stepOn) {
    const ms = Date.now() - startTime;
    send(`DATA,STEPS,${ms},${currentStepCount}`);
  }
}

  function onACC(a) {
    lastAcc = a;
    // LOGGING (aggregated rörelse)
    if (isAggregated && accelOn) {
      accelSum += Math.abs(a.mag - 1);
      accelSamples++;
    }

    // STREAMING
    if (isStreaming && accelOn) {
      const ms = Date.now() - startTime;
      send(`DATA,ACC,${ms},${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`);
    }
    // ================= RAW LOGGING =================
      if (settings.rawMode && accelOn) {

        let timestamp = Date.now();
        let deltaTime = timestamp - lastTimestampAcc;
        lastTimestampAcc = timestamp;

        // konvertera till int16 (matchar C-kod)
        let x = (a.x * 8192) | 0;
        let y = (a.y * 8192) | 0;
        let z = (a.z * 8192) | 0;

        let writeOut = awapp.writeAccelerometer(x, y, z, deltaTime);

        if (writeOut) {
          writeToFlash();
        }
      }
  }

  //function for 6 minutes walking test
 function startSixMWT() {
  sixMWTSeconds = 360;

  // Start aggregated logging
  startCollection();

  // Event start
  let ts = Math.round(Date.now() / 1000);
  send(`EVENT,6MWT_START,${ts}`);
  appendEventRow(1);

  Bangle.buzz();

  sixMWTInterval = setInterval(() => {
    sixMWTSeconds--;

    if (sixMWTSeconds <= 0) {
      clearInterval(sixMWTInterval);
      sixMWTInterval = undefined;

      // Event end
      let ts2 = Math.round(Date.now() / 1000);
      send(`EVENT,6MWT_END,${ts2}`);
      appendEventRow(2);

      Bangle.buzz();

      // Stop logging
      stopCollection();
    }
  }, 1000);
  }

  // ------------- Streaming extra sensorer -------------

  Bangle.on("mag", m => {
    if (isStreaming && magOn) {
      const ms = Date.now() - startTime;
      send(`DATA,MAG,${ms},${m.x.toFixed(3)},${m.y.toFixed(3)},${m.z.toFixed(3)}`);
    }
    // ================= RAW LOGGING =================
      if (settings.rawMode && magOn) {

        let timestamp = Date.now();
        let deltaTime = timestamp - lastTimestampMag;
        lastTimestampMag = timestamp;

        // magnitude (matchar din C-funktion)
        let mag = (m.mag * 8192) | 0;

        let writeOut = awapp.writeMagnetude(mag, deltaTime);

        if (writeOut) {
          writeToFlash();
        }
      }
    lastMag = m;
  });

  Bangle.on("pressure", b => {
    lastTemp = b.temperature;
    // TEMP logging (aggregated)
    if (isAggregated && tempOn) {
      tempSum += b.temperature;
      tempSamples++;
    }

    // TEMP streaming
    if (isStreaming && tempOn) {
      const ms = Date.now() - startTime;
      send(`DATA,TEMP,${ms},${b.temperature.toFixed(2)}`);
    }

    // PRESSURE streaming
    if (isStreaming && pressureOn) {
      const ms = Date.now() - startTime;
      send(`DATA,pressure,${ms},${b.pressure.toFixed(2)},${b.altitude.toFixed(2)},${b.temperature.toFixed(2)}`);
    }
    // ================= RAW LOGGING =================
      if (settings.rawMode && pressureOn) {

        if (!isNaN(b.pressure) && !isNaN(b.temperature)) {

          let timestamp = Date.now();
          let deltaTime = timestamp - lastTimestampBaro;
          lastTimestampBaro = timestamp;

          // skriv till buffers
          tempBDataView.setFloat64(0, b.temperature, true);
          pressBDataView.setFloat64(0, b.pressure, true);
          pressAltBDataView.setFloat64(0, b.altitude || 0, true);

          let writeOut = awapp.writeBarometer(
            tempBAddr,
            pressBAddr,
            pressAltBAddr,
            deltaTime
          );

          if (writeOut) {
            writeToFlash();
          }
        }
      }
  });


  Bangle.on("GPS", g => {
    if (isStreaming && gpsOn) {
      const ms = Date.now() - startTime;
      send(`DATA,GPS,${ms},${g.lat.toFixed(6)},${g.lon.toFixed(6)},${g.alt}`);
    }

     if (settings.rawMode && gpsOn) {

      // säkerställ att data är valid
      if (!isNaN(g.lat) && !isNaN(g.lon) && !isNaN(g.alt)) {

        let timestamp = Date.now();
        let deltaTime = timestamp - lastTimestampGPS;
        lastTimestampGPS = timestamp;

        // skriv till buffer
        latBDataView.setFloat64(0, g.lat, true);
        longBDataView.setFloat64(0, g.lon, true);
        altBDataView.setFloat64(0, g.alt, true);

        let writeOut = awapp.writeGPS(latBAddr, longBAddr, altBAddr, deltaTime);

        // om buffer full → skriv till flash
        if (writeOut) {
          writeToFlash();
        }
      }
    }
  // spara senaste värde
    lastGPS = g;
  });

  // ---------------- DATA COLLECTION (AGGREGATED) ----------------
  function startAggCollection() {

  // ================= SENSOR START =================
  if (settings.sensors.includes("steps")) {
    startSteps();
    Bangle.on("step", onSTEP);
  }

  if (settings.sensors.includes("accel")) {
    startAccel();
    Bangle.on("accel", onACC);
  }

  if (settings.sensors.includes("temp")) startTemp();

  if (settings.sensors.includes("hr")) {
    startHRM();
    Bangle.on("HRM", onHRM);
    hrmBuffer = [];
    hrTimer = setInterval(measureHR, 20000);
  }

  if (settings.emaEnabled) startEMA();

  // ================= AGG TIMER =================
  logTimer = setInterval(() => {

    let ts = Math.round(Date.now() / 1000);
    let batt = E.getBattery();

    let tempAvg = tempSamples ? (tempSum / tempSamples) : 0;
    let tempByte = Math.round(tempAvg);

    appendAggRow(
      ts,
      settings.sensors.includes("steps") ? currentStepCount : 0,
      0, 0, 0,
      settings.sensors.includes("hr") ? hr : 0,
      settings.sensors.includes("hr") ? hrConfidence : 0,
      batt,
      settings.sensors.includes("temp") ? tempByte : 0
    );

    // reset
    currentStepCount = 0;
    accelSum = 0;
    accelSamples = 0;
    tempSum = 0;
    tempSamples = 0;

  }, settings.interval * 1000);
}

function startRawCollection() {

  startSteps();
  startAccel();
  startHRM();
  startTemp();
  startPressure();
  startMag();
  startGps();

  logTimer = setInterval(() => {
    appendRawRow();
    currentStepCount = 0;
  }, settings.interval * 1000);
}

function startCollection() {
  
  stopCollection(); // reset state, helps if/when starting multiple times or switching modes
  awapp.clear();

  let now = Date.now();
  lastTimestampMag = now;
  lastTimestampBaro = now;
  lastTimestampGPS = now;

  isAggregated = !settings.rawMode;
  let isRaw = settings.rawMode;

  // ================= FILE SETUP =================
  const fileConfig = {
    raw: {
      name: "collectedRawData.bin",
      size: RAW_FILE_LEN
    },
    agg: {
      name: "collectedAggData.bin",
      size: AGG_FILE_LEN
    }
  };

  const mode = isRaw ? "raw" : "agg";

  config.filename = fileConfig[mode].name;
  config.totalLen = fileConfig[mode].size;
  FILESIZE = config.totalLen;

  Bangle.buzz(300);

  storage.erase(config.filename);
  storage.write(config.filename, new Uint8Array(config.totalLen), 0, config.totalLen);

  config.appendPos = 0;
  rows = [];

  // ================= C BUFFER INIT =================
  writeBuffer = new ArrayBuffer(maxIndex);
  writeBufferDataView = new DataView(writeBuffer);
  writeBufferAddr = E.getAddressOf(writeBufferDataView.buffer, true);

  awapp.initArray(writeBufferAddr, maxIndex);

  // ================= SENSOR CONFIG =================
  awapp.setHRM(settings.sensors.includes("hr"));
  awapp.setAccelerometer(settings.sensors.includes("accel"));

  awapp.setBarometer(
    settings.sensors.includes("temp") ||
    settings.sensors.includes("pressure")
  );

  awapp.setMagnetude(settings.sensors.includes("mag"));
  awapp.setGPS(settings.sensors.includes("gps"));

  // ================= WRITE CONFIG HEADER (VIKTIG) =================
  awapp.writeIDsToArray();

  // ================= START MODE =================
  if (isRaw) {
    startRawCollection();
  } else {
    startAggCollection();
  }
}

function stopCollection() {
  writeBuffer = null;
  writeBufferDataView = null;
  writeBufferAddr = 0;
  
  if (rows.length > 0) flushRows();

  if (logTimer) clearInterval(logTimer);
  if (hrTimer) clearInterval(hrTimer);

  logTimer = null;
  hrTimer = null;

  stopSteps();
  stopAccel();
  stopHRM();
  stopTemp();
  stopPressure();
  stopMag();
  stopGps();

  stopEMA();

  isAggregated = false;

  Bangle.buzz(200);
}


  // ---------------- BLUETOOTH COMMANDS (STREAMING) ----------------

  Bluetooth.on("data", function(d) {
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

      if (cmd === "MAG_ON") startMag();
      if (cmd === "MAG_OFF") stopMag();

      if (cmd === "pressure_ON") startPressure();
      if (cmd === "pressure_OFF") stopPressure();

      if (cmd === "TEMP_ON") startTemp();
      if (cmd === "TEMP_OFF") stopTemp();

      if (cmd === "GPS_ON") startGps();
      if (cmd === "GPS_OFF") stopGps();

      if (cmd === "START") {
        isStreaming = true;
        isAggregated = false;
        startTime = Date.now();

        if (hrmOn) startHRM();
        if (accelOn) startAccel();
        if (stepOn) startSteps();
        if (magOn) startMag();
        if (pressureOn) startPressure();
        if (tempOn) startTemp();
        if (gpsOn) startGps();
        send("DEBUG: TEST STARTED");
      }

      if (cmd === "STOP") {
        isStreaming = false;
        if (streamStepTimer) {
          clearInterval(streamStepTimer);
          streamStepTimer = null;
        }
        stopHRM();
        stopAccel();
        stopSteps();
        stopMag();
        stopPressure();
        stopTemp();
        stopGps();
        send("STOPPED");
      }
    });
  });

  function sendEMA() {
    if (!emaON) return;
    E.showAlert("Get up!").then(() => {
      showEMAMenu();
    });
  }

  function startEMA() {
    if (!isAggregated) return;
    if (emaON) return;

    emaON = true;
    Bangle.buzz(300);

    emaTimer = setInterval(() => {
      sendEMA();
    }, settings.emaInterval * 1000); //turning seconds to ms
  }
  
  function stopEMA() {
    if (!emaON) return;
    emaON = false;
    if (emaTimer) {
      clearInterval(emaTimer);
      emaTimer = null;
    }
    Bangle.buzz(200); //configurable to change the length of the vibration
  }

  // ---------------- MENU ----------------

  function showMainMenu() {
    E.showMenu({
      "": { title: "AW app" },

      "Start streaming": () => {
        E.showMessage("Streaming\nControlled on the webb");
      },

      "Local logging": () => showLoggingMenu(),

      "Timed test": () => timedTest(),
      "EMA settings": () => showEMAMenu()
    });
  }

  function intervalMenu() {
    const menu = {
      "" : { title : "Sampling Interval (sec)" },
      "Value" : {
        value : settings.interval,
        min : 5, max : 190, step : 1,
        format : v => v + " s",
        onchange : v => {
          settings.interval = v;
          storage.writeJSON("awapp.settings.json", settings);
        }
      },
      "< Back" : () => { showMainMenu(); }
    };
    E.showMenu(menu);
  }

  function showSensorList() {
    let menu = {
      "": { title: "Active sensors" },
      "< Back": () => showMainMenu()
    };

    let allSensors = ["steps", "accel", "hr", "temp"];

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

  function showLoggingMenu() {
    E.showMenu({
      "": { title: "Logging" },
      
       "Raw data": {
      value: settings.rawMode,
      onchange: v => {
        settings.rawMode = true;
        storage.writeJSON("awapp.settings.json", settings);
        showLoggingMenu(); // uppdatera menyn visuellt
      }
    },

    "Aggregated data": {
      value: !settings.rawMode,
      onchange: v => {
        settings.rawMode = false;
        storage.writeJSON("awapp.settings.json", settings);
        showLoggingMenu(); // uppdatera menyn visuellt
      }
    },

    "Ramsize": {
      value: settings.ramSize,
      min: 1,
      max: 6144,
      step: 256,
      format: v => v + " rows",
      onchange: v => {
        settings.ramSize = v;
        storage.writeJSON("awapp.settings.json", settings);
      }
    },

      "Choose sensors": () => showSensorList(),
      "Set Interval": () => intervalMenu(),
      "Start": () => startCollection(),
      "Stop": () => stopCollection(),
      "< Back": () => showMainMenu()
    });
  }

  function timedTest(){
    E.showMenu({
      "Choose sensors": () => showSensorList(),
      "Set Interval": () => intervalMenu(),
      "Start 6MWT" : () => startSixMWT(),
      "< Back": () => showMainMenu()
    });

    }
  function showEMAMenu() {
    E.showMenu({
      "": { title: "EMA Settings" },

      "Enabled": {
        value: settings.emaEnabled,
        onchange: v => {
          settings.emaEnabled = v;
          storage.writeJSON("awapp.settings.json", settings);

          if (!v) stopEMA(); // turn off if disabled
        }
      },

      "Interval (sec)": {
        value: settings.emaInterval,
        min: 60,
        max: 86400, //max 24h
        step: 60,
        format: v => v + " s",
        onchange: v => {
          settings.emaInterval = v;

          // Restart timer
          if (emaON && isAggregated) {
            stopEMA();
            startEMA();
          }

          storage.writeJSON("awapp.settings.json", settings);
        }
      },

      "Test Alert": () => sendEMA(),
      "< Back": () => showMainMenu()
    });
  }

  showMainMenu();

  // Load settings from storage
  try {
    let savedSettings = storage.readJSON("awapp.settings.json");
    if (savedSettings) {
      settings = Object.assign(settings, savedSettings);
      if (settings.emaEnabled) {
        startEMA();
      }
    }
  } catch (e) {
    send("DEBUG: Could not load settings");
  }
  Bangle.loadWidgets();
  Bangle.drawWidgets();

  //Terminal.setConsole(true);
})();