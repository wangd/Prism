const Cc = Components.classes;
const Ci = Components.interfaces;

EXPORTED_SYMBOLS = ["WebAppInstall"];

function WebAppInstall()
{
}

WebAppInstall.prototype = {
  createShortcut : function(name, id, icon) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var webrunner = dirSvc.get("resource:app", Ci.nsIFile);
    webrunner.append("webrunner.exe");

    var appIcon = dirSvc.get("ProfD", Ci.nsIFile);
    appIcon.append("webapps");
    appIcon.append(id);
    appIcon.append("icons");
    appIcon.append("default");

    var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    var os = xulRuntime.OS.toLowerCase();
    if (os == "winnt") {
      appIcon.append(icon + ".ico");
      this._createShortcutWindows(webrunner.path, name, id, appIcon.path);
    }
    else if (os == "linux") {
      appIcon.append(icon + ".xpm");
      this._createShortcutLinux(webrunner.path, name, id, appIcon.path);
    }
    else if (os == "darwin") {
      appIcon.append(icon + ".icns");
      this._createShortcutMac(webrunner.path, name, id, appIcon.path);
    }
  },

  _createShortcutWindows : function(target, name, id, icon) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var file = dirSvc.get("TmpD", Ci.nsIFile);
    file.append("shortcut.vbs");
    if (file.exists())
      file.remove(false);
    file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

    var ioSvc = Cc["@mozilla.org/io/scriptable-io;1"].getService(Ci.nsIScriptableIO);
    var stream = ioSvc.newOutputStream(file, "text write create truncate");

    var cmd = "Set oWsh = CreateObject(\"WScript.Shell\")\n";
    cmd += "sDesktop = oWsh.SpecialFolders(\"Desktop\")\n";
    cmd += "Set oShortcut = oWsh.CreateShortcut(sDesktop & \"\\" + name + ".lnk\")\n";
    cmd += "oShortcut.TargetPath = \"" + target + "\"\n";
    cmd += "oShortcut.Arguments = \"-webapp " + id + "\"\n";
    cmd += "oShortcut.IconLocation = \"" + icon + "\"\n";
    cmd += "oShortcut.Save"

    stream.writeString(cmd);
    stream.close();

    file.launch();
  },

  _createShortcutLinux : function(target, name, id, icon) {
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
    cmd += "Icon=" + icon + "\n";

    stream.writeString(cmd);
    stream.close();
  },

  _createShortcutMac : function(target, name, id, icon) {
  }
}
