/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is WebRunner.
 *
 * The Initial Developer of the Original Code is Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Finkle <mark.finkle@gmail.com>, <mfinkle@mozilla.com>
 *   Cesar Oliveira <a.sacred.line@gmail.com>
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://app/modules/ImageUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

const PR_WRONLY = 0x02;
const PR_CREATE_FILE = 0x08;
const PR_TRUNCATE = 0x20;

EXPORTED_SYMBOLS = ["WebAppInstall"];

var WebAppInstall =
{
  createApplication : function(params) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Creating a webapp install requires an ID
    if (params.hasOwnProperty("id") == true && params.id.length > 0) {
      var iconTitle = "webrunner";

      // Now we will build the webapp folder in the profile
      var appSandbox = dirSvc.get("ProfD", Ci.nsIFile);
      appSandbox.append("webapps");
      appSandbox.append(params.id);
      if (appSandbox.exists())
        appSandbox.remove(true);

      var appINI = appSandbox.clone();
      appINI.append("webapp.ini");
      appINI.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

      // Save the params to an INI file
      var cmd = "[Parameters]\n";
      cmd += "id=" + params.id + "\n";
      cmd += "uri=" + params.uri + "\n";
      cmd += "icon=" + iconTitle + "\n";
      cmd += "status=" + params.status + "\n";
      cmd += "location=" + params.location + "\n";
      cmd += "sidebar=" + params.sidebar + "\n";
      cmd += "navigation=" + params.navigation + "\n";

      var stream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
      stream.init(appINI, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0600, 0);
      stream.write(cmd, cmd.length);
      stream.close();

      // Copy the icon
      var appIcon = appSandbox.clone();

      appIcon.append("icons");
      appIcon.append("default");
      if (!appIcon.exists())
        appIcon.create(Ci.nsIFile.DIRECTORY_TYPE, 0600);
      appIcon.append(iconTitle + ImageUtils.getNativeIconExtension());

      stream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
      stream.init(appIcon, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0600, 0);
      var bufferedStream =
        Components.classes["@mozilla.org/network/buffered-output-stream;1"].
        createInstance(Components.interfaces.nsIBufferedOutputStream);
      bufferedStream.init(stream, 1024);

      bufferedStream.writeFrom(params.icon, params.icon.available());
      bufferedStream.close();

      return appIcon;
    }
  },

  createShortcut : function(name, id, icon, location) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var target = dirSvc.get("XREExeF", Ci.nsIFile);

    /* Check to see if were pointing to a binary (eg. xulrunner-bin).
     * We always want to point to xulrunner rather than xulrunner-bin,
     * because xulrunner will set up the library paths
     */
    if (target.leafName.search("-bin") != -1) {
      let target_shell = target.parent;
      target_shell.append(target.leafName.replace("-bin", ""));
      if (target_shell.exists()) {
        target = target_shell;
      }
    }

    var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    var os = xulRuntime.OS.toLowerCase();
    if (os == "winnt") {
      this._createShortcutWindows(target, name, id, icon, location);
    }
    else if (os == "linux") {
      this._createShortcutLinux(target, name, id, icon, location);
    }
    else if (os == "darwin") {
      var targetAdj = target.parent.clone();
      targetAdj.append("prism");
      this._createShortcutMac(targetAdj, name, id, icon, location);
    }
  },

  _createShortcutWindows : function(target, name, id, icon, location) {
    var locations = location.split(",");

    var desktop = Cc["@mozilla.org/desktop-environment;1"].
      getService(Ci.nsIDesktopEnvironment);
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var shortcut = null;
    var directory = null;
    for (var i=0; i<locations.length; i++)
    {
      if (locations[i] == "desktop") {
        directory = dirSvc.get("Desk", Ci.nsIFile);
      }
      else if (locations[i] == "programs") {
        directory = dirSvc.get("Progs", Ci.nsIFile);
        directory.append("Web Apps");
      }
      else if (locations[i] == "quicklaunch") {
        directory = dirSvc.get("QuickLaunch", Ci.nsIFile);
      }
      else {
        continue;
      }

      desktop.createShortcut(name, target, directory, "", "-webapp " + id, "", icon);

    }
  },

  _createShortcutLinux : function(target, name, id, icon, location) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var file = dirSvc.get("Desk", Ci.nsIFile);
    file.append(name + ".desktop");
    if (file.exists())
      file.remove(false);
    file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

    var cmd = "[Desktop Entry]\n";
    cmd += "Name=" + name + "\n";
    cmd += "Type=Application\n";
    cmd += "Comment=Web Application\n";
    cmd += "Exec=" + target.path + " -webapp " + id + "\n";
    cmd += "Icon=" + icon.path + "\n";

    var stream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
    stream.init(file, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0600, 0);
    stream.write(cmd, cmd.length);
    stream.close();
  },

  _createShortcutMac : function(target, name, id, icon, location) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var xre = dirSvc.get("XREExeF", Ci.nsIFile);

    var locations = location.split(",");

    var bundle = null;
    if (locations.indexOf("desktop") > -1) {
      var desk = dirSvc.get("Desk", Ci.nsIFile);
      bundle = this._createBundle(target, name, id, icon, desk);
    }
    if (locations.indexOf("applications") > -1) {
      var apps = dirSvc.get("LocApp", Ci.nsIFile);
      //apps.append("Web Apps");
      if (!apps.exists())
        apps.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
      bundle = this._createBundle(target, name, id, icon, apps);
    }
    if (locations.indexOf("dock") > -1 && bundle != null) {
      var dock = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIMacDock);
      dock.addApplication(bundle);
    }
  },

  _createBundle : function(target, name, id, icon, location) {
    var contents =
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
    "<!DOCTYPE plist PUBLIC \"-//Apple Computer//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n" +
    "<plist version=\"1.0\">\n" +
    "<dict>\n" +
    "<key>CFBundleExecutable</key>\n" +
    "<string>" + name + "</string>\n" +
    "<key>CFBundleIconFile</key>\n" +
    "<string>" + icon.leafName + "</string>\n" +
    "</dict>\n" +
    "</plist>";

    location.append(name + ".app");
    if (location.exists())
      location.remove(true);
    location.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    
    var bundle = location.clone();

    location.append("Contents");
    location.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);

    var info = location.clone();
    info.append("Info.plist");
    var stream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
    stream.init(info, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0600, 0);
    stream.write(contents, contents.length);
    stream.close();

    var resources = location.clone();
    resources.append("Resources");
    resources.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    icon.copyTo(resources, icon.leafName);

    var macos = location.clone();
    macos.append("MacOS");
    macos.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);

    var cmd = "#!/bin/sh\nexec " + target.path + " -webapp " + id;
    var script = macos.clone();
    script.append(name);
    stream.init(script, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0755, 0);
    stream.write(cmd, cmd.length);
    stream.close();

    return bundle;
  }
};
