// Load widgets
Bangle.loadWidgets();

let historiographer= E.compiledC(`
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

let storage = require("Storage");
let file = {
  name : "user.bin",
  offset : 0, // force a new file to be generated at first
};

let maxIndex = 768;
let FILESIZE = 0;
let writeBuffer = new ArrayBuffer(maxIndex);
let writeBufferDataView = new DataView(writeBuffer);
let writeBufferAddr = E.getAddressOf(writeBufferDataView.buffer,true);

let started = false;
let lastTimestamp = 0;

let powerAccelerometer = false;

// Add new data to a log file or switch log files
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
  }
}

function writeToFlash(){
  if(file.offset < FILESIZE){
    saveData(writeBufferDataView.buffer);
  }

  historiographer.clear();
  if(file.offset >= FILESIZE){
    clearTimeout(drawTimeout);
    fullStorage();
    Bangle.buzz();
    Bangle.buzz();
    Bangle.buzz();
  }
}


function onAccel(a){
  if(!started) return;
    var timestamp = Math.round(Date.now());
    var deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    var x = a.x * 8192.0;
    var y = a.y * 8192.0;
    var z = a.z * 8192.0;  

    var writeOut = historiographer.writeAccelerometer(x,y,z,deltaTime);
    if(writeOut){
      writeToFlash();
    }
}



function configureSensors(){    
  if(powerAccelerometer){
    Bangle.selectedAccelerometer(1);
    historiographer.setAccelerometer(true);
  }
  else{
    Bangle.selectedAccelerometer(0);
  }
}

function writeConfiguration(){
  
  require("Storage").erase("user.bin");
  require("Storage").compact(true);

  file.offset = 0;
  historiographer.initArray(writeBufferAddr, maxIndex);
  configureSensors();  
  historiographer.writeIDsToArray();
  
  var time = Math.round(Date.now());
  lastTimestamp = time;
  var date = new Date(time);
  historiographer.writeDate(date.getFullYear(), date.getMonth(), date.getDate());
  var writeOut = historiographer.writeTime(date.getHours(), date.getMinutes());

  if(writeOut){
    writeToFlash();
  }

  Bangle.buzz();
  Bangle.buzz();
  started = true;
}

Bangle.on('accel', function(accelEvent) {
  if(started && powerAccelerometer){
      onAccel(accelEvent);
    }
    });

// First menu
var mainmenu = {
  "" : { "title" : "Main Menu" },
  "< Back" : function() { load(); },
  "Start" : function() {
    writeConfiguration();
  },
  "Settings": function(){E.showMenu(menuSettings);},
  "Exit" : function() { load(); }, // remove the menu
};

var submenuSensors;
var menuSettings;

function reloadMenus(){
menuSettings = {
  "" : { "title" : "Settings" },
  "< Back" : function() { E.showMenu(mainmenu); }, 
  "Sensors" : function() { E.showMenu(submenuSensors); },
};

submenuSensors = {
  "" : { "title" : "Sensors" },
  "< Back" : function() { E.showMenu(menuSettings); },
  "Accel." : {
      value: powerAccelerometer,
      onchange: v => {
          powerAccelerometer = v;
          Bangle.getAccel(v ? 1 : 0);
    }
      },
};
}

reloadMenus();
Bangle.getAccel(0);
Bangle.loadWidgets();
Bangle.drawWidgets();
E.showMenu(mainmenu);