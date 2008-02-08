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
 *   Matthew Gertner <matthew@allpeers.com>
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://prism/modules/ImageUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

const PR_WRONLY = 0x02;
const PR_CREATE_FILE = 0x08;
const PR_TRUNCATE = 0x20;
const PR_UINT32_MAX = 4294967295;

EXPORTED_SYMBOLS = ["WebAppInstall", "WebAppProperties"];

/**
 * Constructs an nsISimpleEnumerator for the given array of items.
 */
function ArrayEnumerator(aItems) {
  this._items = aItems;
  this._nextIndex = 0;
}

ArrayEnumerator.prototype = {
  hasMoreElements: function()
  {
    return this._nextIndex < this._items.length;
  },
  getNext: function()
  {
    if (!this.hasMoreElements())
      throw Components.results.NS_ERROR_NOT_AVAILABLE;

    return this._items[this._nextIndex++];
  },
  QueryInterface: function(aIID)
  {
    if (Ci.nsISimpleEnumerator.equals(aIID) ||
        Ci.nsISupports.equals(aIID))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

/**
 * Directory provider that provides access to external chrome icons
 */
const NS_APP_CHROME_DIR_LIST = "AChromDL";

function IconProvider(aFolder) {
  this._folder = aFolder;
}

IconProvider.prototype = {
  getFile: function(prop, persistent) {
    return Components.results.NS_ERROR_FAILURE;
  },

  getFiles: function(prop, persistent) {
    if (prop == NS_APP_CHROME_DIR_LIST) {
      return new ArrayEnumerator([this._folder]);
    }
    else {
      return Components.results.NS_ERROR_FAILURE;
    }
  },

  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsIDirectoryServiceProvider) ||
        iid.equals(Ci.nsIDirectoryServiceProvider2) ||
        iid.equals(Ci.nsISupports))
    {
      return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

var WebAppProperties =
{
  script : {},
  id : "",
  fileTypes : [],
  uri : null,
  icon : "webapp",
  status : false,
  location : false,
  sidebar : false,
  trayicon: false,
  credits : "",
  navigation : false,
  appBundle : null,
  flags : ["id", "uri", "icon", "status", "location", "sidebar", "trayicon", "navigation", "credits"]
};

var WebAppInstall =
{
  setParameter: function(aName, aValue) {
    if (WebAppProperties.flags.indexOf(aName) == -1)
      return;

    if (typeof WebAppProperties[aName] == "boolean")
      aValue = (aValue.toLowerCase() == "true" || aValue.toLowerCase() == "yes");

    WebAppProperties[aName] = aValue;
  },

  readCommandLine : function(aCmdLine) {
    for (var index in WebAppProperties.flags) {
      var key = WebAppProperties.flags[index];
      var value = aCmdLine.handleFlagWithParam(key, false);
      if (value != null)
        this.setParameter(key, value);
    }
  },

  readINI : function(aFile) {
    var iniFactory = Components.manager.getClassObjectByContractID("@mozilla.org/xpcom/ini-parser-factory;1", Ci.nsIINIParserFactory);
    var iniParser = iniFactory.createINIParser(aFile);

    var keys = iniParser.getKeys("Parameters");
    while (keys.hasMore()) {
      var key = keys.getNext();
      var value = iniParser.getString("Parameters", key);
      this.setParameter(key.toLowerCase(), value);
    }

    keys = iniParser.getKeys("FileTypes");
    while (keys.hasMore()) {
      var key = keys.getNext();
      var value = iniParser.getString("Parameters", key);
      var values = value.split(";");
      if (values.length == 4) {
        var type = {};
        type.name = values[0];
        type.extension = values[1];
        type.description = values[2];
        type.contentType = values[3];
        WebAppProperties.fileTypes.push(type);
      }
    }
  },

  init : function(aFile) {
    var appSandbox = aFile.clone();

    // Read the INI settings
    var appINI = appSandbox.clone();
    appINI.append("webapp.ini");
    if (appINI.exists())
      this.readINI(appINI);

    // Load the application script
    var appScript = appSandbox.clone();
    appScript.append("webapp.js");
    if (appScript.exists()) {
      var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      var appScriptURI = ios.newFileURI(appScript);

      var scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
      scriptLoader.loadSubScript(appScriptURI.spec, WebAppProperties.script);
    }

    // Load the application style
    var appStyle = appSandbox.clone();
    appStyle.append("webapp.css");
    if (appStyle.exists()) {
      var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      var appStyleURI = ios.newFileURI(appStyle);

      var styleSheets = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
      styleSheets.loadAndRegisterSheet(appStyleURI, styleSheets.USER_SHEET);
    }

    // Initialize the icon provider
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var iconProvider = new IconProvider(aFile);
    dirSvc.QueryInterface(Ci.nsIDirectoryService).registerProvider(iconProvider);
  },

  install : function(aFile) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    try {
      var reader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
      reader.open(aFile);
      reader.test(null);

      // Extract the webapp.ini to a temp location so it can be parsed
      var tempINI = dirSvc.get("TmpD", Ci.nsIFile);
      tempINI.append("webapp.ini");
      tempINI.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
      reader.extract("webapp.ini", tempINI);
      this.readINI(tempINI);
      tempINI.remove(false);

      // Creating a webapp install requires an ID
      if (WebAppProperties.id.length > 0) {
        var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
        var iconExt = ImageUtils.getNativeIconExtension();

        // Now we will build the webapp folder in the profile
        var appSandbox = dirSvc.get("ProfD", Ci.nsIFile);
        appSandbox.append("webapps");
        appSandbox.append(WebAppProperties.id);
        if (appSandbox.exists())
          appSandbox.remove(true);

        // Make a copy so we can return it
        aFile = appSandbox.clone();

        var appINI = appSandbox.clone();
        appINI.append("webapp.ini");
        appINI.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
        reader.extract("webapp.ini", appINI);

        if (reader.hasEntry("webapp.js")) {
          var appScript = appSandbox.clone();
          appScript.append("webapp.js");
          appScript.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
          reader.extract("webapp.js", appScript);
        }

        // We check for an OS specific and common stylesheet,
        // defaulting to the OS specific sheet
        var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
        var os = xulRuntime.OS.toLowerCase();
        if (reader.hasEntry(os + "/webapp.css") || reader.hasEntry("webapp.css")) {
          var appStyle = appSandbox.clone();
          appStyle.append("webapp.css");
          appStyle.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
          if (reader.hasEntry(os + "/webapp.css"))
            reader.extract(os + "/webapp.css", appStyle);
          else
            reader.extract("webapp.css", appStyle);
        }

        var iconName = WebAppProperties.icon + iconExt;
        var pngName = WebAppProperties.icon + ".png";
        var appIcon = appSandbox.clone();
        appIcon.append("icons");
        appIcon.append("default");

        if (reader.hasEntry(iconName)) {
          appIcon.append(iconName);
          appIcon.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
          reader.extract(iconName, appIcon);
        }
        else if (reader.hasEntry(pngName))
        {
          var targetPath = appIcon.clone();
          appIcon.append(pngName);
          appIcon.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
          reader.extract(pngName, appIcon);

          var storageStream = ImageUtils.createNativeIconFromFile(appIcon);
          var inputStream = storageStream.newInputStream(0);

          var nativeIcon = appIcon.parent.clone();
          var fileTitle = appIcon.leafName;
          var dot = fileTitle.lastIndexOf(".");
          if (dot != -1)
            fileTitle = fileTitle.substring(0, dot);
          nativeIcon.append(fileTitle + ImageUtils.getNativeIconExtension());

          var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
          stream.init(nativeIcon, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0600, 0);

          var bss = Cc["@mozilla.org/network/buffered-output-stream;1"].
                    createInstance(Ci.nsIBufferedOutputStream);
          bss.init(stream, 1024);

          bss.writeFrom(inputStream, inputStream.available());
          bss.close();
        }
        else {
          // webapp.ini doesn't have its own icon, so we substitute the
          // default icon instead
          var defaultIcon = dirSvc.get("resource:app", Ci.nsIFile);

          defaultIcon.append("chrome");
          defaultIcon.append("icons");
          defaultIcon.append("default");
          defaultIcon.append(iconName);

          defaultIcon.copyTo(appIcon, "");
        }
      }
    }
    catch (e) {
      Components.utils.reportError(e);
    }

    WebAppProperties.appBundle = aFile;
    return aFile;
  },

  createApplication : function(params) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Creating a webapp install requires an ID
    if (params.hasOwnProperty("id") == true && params.id.length > 0) {
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
      cmd += "icon=" + WebAppProperties.icon + "\n";
      cmd += "status=" + params.status + "\n";
      cmd += "location=" + params.location + "\n";
      cmd += "sidebar=" + params.sidebar + "\n";
      cmd += "navigation=" + params.navigation + "\n";
      cmd += "trayicon=" + params.trayicon + "\n";

      var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      stream.init(appINI, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0600, 0);
      stream.write(cmd, cmd.length);
      stream.close();

      // Copy the icon
      var appIcon = appSandbox.clone();
      appIcon.append("icons");
      appIcon.append("default");
      if (!appIcon.exists())
        appIcon.create(Ci.nsIFile.DIRECTORY_TYPE, 0600);
      appIcon.append(WebAppProperties.icon + ImageUtils.getNativeIconExtension());

      stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      stream.init(appIcon, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0600, 0);
      var bufferedStream = Cc["@mozilla.org/network/buffered-output-stream;1"].
                           createInstance(Ci.nsIBufferedOutputStream);
      bufferedStream.init(stream, 1024);

      bufferedStream.writeFrom(params.icon.stream, params.icon.stream.available());
      bufferedStream.close();
    }
  },

  createShortcut : function(name, id, location) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Locate the webapp folder in the profile
    var appSandbox = dirSvc.get("ProfD", Ci.nsIFile);
    appSandbox.append("webapps");
    appSandbox.append(id);

    // Locate the webapp icon
    var appIcon = appSandbox.clone();
    appIcon.append("icons");
    appIcon.append("default");
    appIcon.append(WebAppProperties.icon + ImageUtils.getNativeIconExtension());

    // Locate the runtime
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

    var arguments = "";
    var workingPath = "";

    var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
    if (appInfo.name == "Firefox")
    {
      var extensionDir = this.getExtensionDirectory(dirSvc);
      extensionDir.append("prism");

      // We use the working path because of a Windows but that restricts shortcut targets to
      // 260 characters or less.
      workingPath = extensionDir.path;

      var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
      var profileDir = dirSvc.get("ProfD", Ci.nsIFile);
      profileDir.append("webapps");
      profileDir.append(id);

      // This is just a temporary fix until we move the webapp directory out of the profile
      arguments += "-webapp \"" + profileDir.path + "\"";
    }
    else
      arguments += "-webapp " + id;

    var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    var os = xulRuntime.OS.toLowerCase();
    if (os == "winnt") {
      this._createShortcutWindows(target, name, arguments, workingPath, appIcon, location);
    }
    else if (os == "linux") {
      this._createShortcutLinux(target, name, arguments, workingPath, appIcon, location);
    }
    else if (os == "darwin") {
      var targetAdj = target.parent.clone();
      if (appInfo.name == "Firefox")
        targetAdj.append("firefox");
      else
        targetAdj.append("prism");
      this._createShortcutMac(targetAdj, name, arguments, workingPath, appIcon, location);
    }
  },

  _createShortcutWindows : function(target, name, arguments, workingPath, icon, location) {
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

      arguments = "-app application.ini " + arguments;
      desktop.createShortcut(name, target, directory, workingPath, arguments, "", icon);

    }
  },

  _createShortcutLinux : function(target, name, arguments, workingPath, icon, location) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var file = dirSvc.get("Desk", Ci.nsIFile);
    file.append(name + ".desktop");
    if (file.exists())
      file.remove(false);
    file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

    arguments = "-app " + workingPath + "/application.ini " + arguments;

    var cmd = "[Desktop Entry]\n";
    cmd += "Name=" + name + "\n";
    cmd += "Type=Application\n";
    cmd += "Comment=Web Application\n";
    cmd += "Exec=" + target.path + " " + arguments + "\n";
    cmd += "Icon=" + icon.path + "\n";

    var stream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
    stream.init(file, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0600, 0);
    stream.write(cmd, cmd.length);
    stream.close();
  },

  _createShortcutMac : function(target, name, arguments, workingPath, icon, location) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var xre = dirSvc.get("XREExeF", Ci.nsIFile);

    arguments = "-app " + workingPath + "/application.ini " + arguments;

    var locations = location.split(",");

    var bundle = null;
    if (locations.indexOf("desktop") > -1) {
      var desk = dirSvc.get("Desk", Ci.nsIFile);
      bundle = this._createBundle(target, name, arguments, icon, desk);
    }
    if (locations.indexOf("applications") > -1) {
      var apps = dirSvc.get("LocApp", Ci.nsIFile);
      //apps.append("Web Apps");
      if (!apps.exists())
        apps.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
      bundle = this._createBundle(target, name, arguments, icon, apps);
    }
    if (locations.indexOf("dock") > -1 && bundle != null) {
      var dock = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIMacDock);
      dock.addApplication(bundle);
    }
  },

  _createBundle : function(target, name, arguments, icon, location) {
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

    var cmd = "#!/bin/sh\nexec " + target.path + " " + arguments;
    var script = macos.clone();
    script.append(name);
    stream.init(script, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0755, 0);
    stream.write(cmd, cmd.length);
    stream.close();

    return bundle;
  },

  getExtensionDirectory : function(dirSvc)
  {
    var extensionDirs = dirSvc.get("XREExtDL", Ci.nsISimpleEnumerator);
    while (extensionDirs.hasMoreElements())
    {
      var extensionDir = extensionDirs.getNext().QueryInterface(Ci.nsIFile);
      if (extensionDir.leafName == "refractor@developer.mozilla.org")
        return extensionDir;
    }

    throw Components.results.NS_ERROR_NOT_AVAILABLE;
  }
};
