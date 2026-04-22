**Uploading the BangleJS app to Espruino IDE:**

1. Connect the watch to the IDE.
2. Press on the tiny white arrow down to the right under the upload button to view all upload destinations.
3. Choose storage and then click on “New file”. 
4. Give the new file the exact same name as the app file. In this case, the filename is aw.app.js.
      You can find the code file here!
5. Click on OK.
6. Copy paste the aw.app.js code into the IDE console (to the right) and the press upload. 
7. When the code/file has finished uploading. Copy paste the following information into the IDE terminal (on the left side), and press enter on the keyboard. Then terminal will return =true if correctly done. This info will then be stored in storage. 
         require("Storage").write("aw.info",{
           "id":"aw",
           "name":"AW app",
           "src":"aw.app.js"
         });
8. Then you should be able to use the app as a “regular app” on the bangle watch. The app should also still be on the watch if you reboot the watch.
