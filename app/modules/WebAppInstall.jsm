const Cc = Components.classes;
const Ci = Components.interfaces;

EXPORTED_SYMBOLS = ["WebAppInstall"];

function WebAppInstall()
{
}

WebAppInstall.prototype = {
  createShortcut : function(name, id, icon, location) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var webrunner = dirSvc.get("resource:app", Ci.nsIFile);

    var xre = dirSvc.get("XREExeF", Ci.nsIFile);

    var appIcon = dirSvc.get("ProfD", Ci.nsIFile);
    appIcon.append("webapps");
    appIcon.append(id);
    appIcon.append("icons");
    appIcon.append("default");

    var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    var os = xulRuntime.OS.toLowerCase();
    if (os == "winnt") {
      webrunner.append("webrunner.exe");
      appIcon.append(icon + ".ico");
      this._createShortcutMac(webrunner.path, name, id, appIcon, location);
//      this._createShortcutWindows(webrunner.path, name, id, appIcon, location);
    }
    else if (os == "linux") {
      webrunner.append("webrunner");
      appIcon.append(icon + ".xpm");
      this._createShortcutLinux(webrunner.path, name, id, appIcon, location);
    }
    else if (os == "darwin") {
      webrunner.append("webrunner");
      appIcon.append(icon + ".icns");
      this._createShortcutMac(webrunner.path, name, id, appIcon, location);
    }
  },

  _createShortcutWindows : function(target, name, id, icon, location) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var locations = location.split(",");

    var programs = dirSvc.get("Progs", Ci.nsIFile);
    programs.append("Web Apps");
    if (!programs.exists())
      programs.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);

    var quicklaunch = dirSvc.get("AppData", Ci.nsIFile);
    quicklaunch.append("Microsoft");
    quicklaunch.append("Internet Explorer");
    quicklaunch.append("Quick Launch");

    var file = dirSvc.get("TmpD", Ci.nsIFile);
    file.append("shortcut.vbs");
    if (file.exists())
      file.remove(false);
    file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

    var ioSvc = Cc["@mozilla.org/io/scriptable-io;1"].getService(Ci.nsIScriptableIO);
//    var stream = ioSvc.newOutputStream(file, "text write create truncate");
    var stream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);

    var cmd = "Set oWsh = CreateObject(\"WScript.Shell\")\n";
    if (locations.indexOf("desktop") > -1) {
      cmd += "sLocation = oWsh.SpecialFolders(\"Desktop\")\n";
      cmd += "Set oShortcut = oWsh.CreateShortcut(sLocation & \"\\" + name + ".lnk\")\n";
      cmd += "oShortcut.TargetPath = \"" + target + "\"\n";
      cmd += "oShortcut.Arguments = \"-webapp " + id + "\"\n";
      cmd += "oShortcut.IconLocation = \"" + icon.path + "\"\n";
      cmd += "oShortcut.Save\n"
    }
    if (locations.indexOf("programs") > -1 && programs.exists()) {
      cmd += "sLocation = oWsh.SpecialFolders(\"Programs\") & \"\\Web Apps\"\n";
      cmd += "Set oShortcut = oWsh.CreateShortcut(sLocation & \"\\" + name + ".lnk\")\n";
      cmd += "oShortcut.TargetPath = \"" + target + "\"\n";
      cmd += "oShortcut.Arguments = \"-webapp " + id + "\"\n";
      cmd += "oShortcut.IconLocation = \"" + icon.path + "\"\n";
      cmd += "oShortcut.Save\n"
    }
    if (locations.indexOf("quicklaunch") > -1 && quicklaunch.exists()) {
      cmd += "sLocation = \"" + quicklaunch.path + "\"\n";
      cmd += "Set oShortcut = oWsh.CreateShortcut(sLocation & \"\\" + name + ".lnk\")\n";
      cmd += "oShortcut.TargetPath = \"" + target + "\"\n";
      cmd += "oShortcut.Arguments = \"-webapp " + id + "\"\n";
      cmd += "oShortcut.IconLocation = \"" + icon.path + "\"\n";
      cmd += "oShortcut.Save\n"
    }

    stream.writeString(cmd);
    stream.close();

    file.launch();
  },

  _createShortcutLinux : function(target, name, id, icon, location) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var file = dirSvc.get("Desk", Ci.nsIFile);
    file.append(name + ".desktop");
    if (file.exists())
      file.remove(false);
    file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

    var ioSvc = Cc["@mozilla.org/io/scriptable-io;1"].getService(Ci.nsIScriptableIO);
    var stream = ioSvc.newOutputStream(file, "text write create truncate");

    var cmd = "[Desktop Entry]\n";
    cmd += "Name=" + name + "\n";
    cmd += "Type=Application\n";
    cmd += "Comment=Web Application\n";
    cmd += "Exec=" + target + " -webapp " + id + "\n";
    cmd += "Icon=" + icon.path + "\n";

    stream.writeString(cmd);
    stream.close();
  },

  _createShortcutMac : function(target, name, id, icon, location) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var xre = dirSvc.get("XREExeF", Ci.nsIFile);

    var locations = location.split(",");

    if (locations.indexOf("desktop") > -1) {
      var desk = dirSvc.get("Desk", Ci.nsIFile);
      this._createBundle(target, name, id, icon, desk);
    }
    if (locations.indexOf("applications") > -1) {
      var apps = dirSvc.get("LocApp", Ci.nsIFile);
      apps.append("Web Apps");
      if (!apps.exists())
        apps.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
      this._createBundle(target, name, id, icon, apps);
    }
    if (locations.indexOf("dock") > -1) {
      // ???
    }
  },

  _createBundle : function(target, name, id, icon, location) {
    var contents =
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
    "<!DOCTYPE plist PUBLIC \"-//Apple Computer//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n" +
    "<plist version=\"1.0\">\n" +
    "<dict>\n" +
    "<key>CFBundleInfoDictionaryVersion</key>\n" +
    "<string>6.0</string>\n" +
    "<key>CFBundlePackageType</key>\n" +
    "<string>APPL</string>\n" +
    "<key>CFBundleExecutable</key>\n" +
    "<string>xulrunner</string>\n" +
    "<key>NSAppleScriptEnabled</key>\n" +
    "<true/>\n" +
    "<key>CFBundleGetInfoString</key>\n" +
    "<string>" + name + "</string>\n" +
    "<key>CFBundleName</key>\n" +
    "<string>" + name + "</string>\n" +
    "<key>CFBundleShortVersionString</key>\n" +
    "<string>1</string>\n" +
    "<key>CFBundleVersion</key>\n" +
    "<string>1.0</string>\n" +
    "<key>CFBundleIconFile</key>\n" +
    "<string>" + icon.leafName + "</string>\n" +
    "</dict>\n" +
    "</plist>";

    location.append(name + ".app");
    if (!location.exists())
      location.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    location.append("Contents");
    if (!location.exists())
      location.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);

    var info = location.clone();
    info.append("Info.plist");
    var ioSvc = Cc["@mozilla.org/io/scriptable-io;1"].getService(Ci.nsIScriptableIO);
    var stream = ioSvc.newOutputStream(info, "text write create truncate");
    stream.writeString(contents);
    stream.close();

    var resources = location.clone();
    resources.append("Resources");
    if (!resources.exists())
      resources.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    icon.copyTo(resources, icon.leafName);

    var macos = location.clone();
    macos.append("MacOS");
    if (!macos.exists())
      macos.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
  }
}
