**Uploading the BangleJS app to Espruino IDE:**

1. Connect the watch to the IDE.  
2. Press on the tiny white arrow down to the right under the upload button to view all upload destinations.![][image1]  
3. Choose storage and then click on “New file”.   
4. Give the new file the exact same name as the app file. In this case, the filename is [aw.app.js](http://aw.app.js).   
   1. You can find the code file [here](https://github.com/muraid/awthesis)\!  
5. Click on OK.  
6. Copy paste the [aw.app.js](http://aw.app.js) code into the IDE console (to the right) and the press upload. The upload button →  ![][image2]  
7. When the code/file has finished uploading. Copy paste the following information into the IDE terminal (on the left side), and press enter on the keyboard. Then terminal will return \=true if correctly done. This info will then be stored in storage. 

   require("Storage").write("aw.info",{

     "id":"aw",

     "name":"AW app",

     "src":"aw.app.js"

   });

8. Then you should be able to use the app as a “regular app” on the bangle watch. The app should also still be on the watch if you reboot the watch. 

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAkCAYAAAAHKVPcAAABwElEQVR4Xu2X20rDQBCG825CPaTWohbR1ogIHqql2ha9spBSmj6AYqXPIPoo6qX6FvZ+9V+ZMNlNmrC0aYQM/HQyO7P77WQTUmtpZU0sWpYaWIRiIVrXN2JjqyKl+hjnvqliIWBYBFJ9jHPfVLEQ6u5T78Rx/cLfeZyQq9YnlQbx9PwiBf/17V22Ookhl2qoPqmyCcFlAmEiDSKuE/ejRynVZtqJKIjvySRw+JDDbaYQXBwi7PTzjsz0dmAyvisYFqN3BOXR40sgVGMCpEFgctq1eib4S0kdo4VN3hnZhAi7HWRJILifVBpEJjqxCMVCYIfUHdXHOPdN9T8g0lAOQcohSDkEKRWIyl5tqlKBmGb4Hpk7xHA4FB+fX+raviFn7hCkMLt7GMkxC6Rw8HtaP/eLcM0VFXPdnhbj4rXc8OFMORKiYK+HTtBoNjWIk7O67xfsooTwPM+PXbXbiSB4jjUYDITb+9uNWgxVnYNIiOViSYNodTraPOSPx+NwiNVSWSYChhdRjGA4GN0CxMi/7XYDC/IaXgvjeRKCX6ja3XcC1yh2Do/ETrXmxwDR7/d//w5sa/VUQ75d3hSNy5aW8wPGtBfbsml4CQAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAVCAYAAAC33pUlAAABOUlEQVR4XmNw9vD6Ty/MgC4Aw2lZOWAMYheVlcNp/+BQMIbJkYIHh2UXLl4iiEm1EMUykOa16zeA2cQAkE9B6mF6CGGiLQMZjA4osgwZw8Cdu3dRxEEGI1uGrg8fRrEMpBkUFyA2CHz+8gUlbkA0iA9yAMwyWPyhG4wNo1iGnMqQAXJqRBdHTrWE8MBZRmuM0zLkVAaLE1j8IadaUjBOy2iBRy2jCqa6ZaDEgw1MnTGTupZFRMf+7+joQLcHDEDyDCBJv6AQsCKYJhC7tbUVLgaiYRiktrGxCc4vK6/AsAzdQpg8Q1tbG4pFMMMLiopRLAPRpcASA8QGWYasFt0yEHv27Nlgi3bs3ImwDFkDjG5qboa7MD4pGUxXVFbB5UGWRcbGoVhUVV39PyIGYpmLpzeY/vHjB1wehAGM/tbhWoWFvAAAAABJRU5ErkJggg==>