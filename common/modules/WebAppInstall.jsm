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

const PR_PERMS_FILE = 0644;
const PR_PERMS_DIRECTORY = 0755;

const PR_UINT32_MAX = 4294967295;

EXPORTED_SYMBOLS = ["WebAppInstall", "WebAppProperties", "FileIO"];

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
  name : null,
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
  flags : ["id", "name", "uri", "icon", "status", "location", "sidebar", "trayicon", "navigation", "credits"]
};

var WebAppInstall =
{
  getInstallRoot : function() {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var installRoot = null;

#ifdef XP_MACOSX
    installRoot = dirSvc.get("ULibDir", Ci.nsIFile);
    installRoot.append("WebApps");
#else
#ifdef XP_UNIX
    installRoot = dirSvc.get("Home", Ci.nsIFile);
    installRoot.append(".webApps");
#else
    installRoot = dirSvc.get("AppData", Ci.nsIFile);
    installRoot.append("WebApps");
#endif
#endif

    return installRoot;
  },

  getProfileRoot : function() {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var profileRoot = null;

#ifdef XP_MACOSX
    profileRoot = dirSvc.get("Home", Ci.nsIFile);

    // FIXME: these strings are probably localized on non en-US
    profileRoot.append("Library");
    profileRoot.append("Application Support");

    profileRoot.append("Prism");
#else
#ifdef XP_UNIX
    profileRoot = dirSvc.get("Home", Ci.nsIFile);
    profileRoot.append(".prism");
#else
    profileRoot = dirSvc.get("AppData", Ci.nsIFile);
    profileRoot.append("Prism");
#endif
#endif

    return profileRoot;
  },

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
      tempINI.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
      reader.extract("webapp.ini", tempINI);
      this.readINI(tempINI);
      tempINI.remove(false);

      // Creating a webapp install requires an ID
      if (WebAppProperties.id.length > 0) {
        var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
        var iconExt = ImageUtils.getNativeIconExtension();

        // Now we will unpack the bundle into the webapp folder
        var appSandbox = this.getInstallRoot();
        appSandbox.append(WebAppProperties.id);
        if (appSandbox.exists())
          appSandbox.remove(true);

        // Make a copy so we can return it
        aFile = appSandbox.clone();

        var appINI = appSandbox.clone();
        appINI.append("webapp.ini");
        appINI.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
        reader.extract("webapp.ini", appINI);

        if (reader.hasEntry("webapp.js")) {
          var appScript = appSandbox.clone();
          appScript.append("webapp.js");
          appScript.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
          reader.extract("webapp.js", appScript);
        }

        // We check for an OS specific and common stylesheet,
        // defaulting to the OS specific sheet
        var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
        var os = xulRuntime.OS.toLowerCase();
        if (reader.hasEntry(os + "/webapp.css") || reader.hasEntry("webapp.css")) {
          var appStyle = appSandbox.clone();
          appStyle.append("webapp.css");
          appStyle.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
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
        appIcon.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

        if (reader.hasEntry(iconName)) {
          appIcon.append(iconName);
          appIcon.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
          reader.extract(iconName, appIcon);
        }
        else if (reader.hasEntry(pngName))
        {
          var targetPath = appIcon.clone();
          appIcon.append(pngName);
          appIcon.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
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
          stream.init(nativeIcon, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, PR_PERMS_FILE, 0);

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
          var defaultIconName = "app" + iconExt;

          defaultIcon.append("chrome");
          defaultIcon.append("icons");
          defaultIcon.append("default");
          defaultIcon.append(defaultIconName);

          defaultIcon.copyTo(appIcon, iconName);
        }
        WebAppProperties.appBundle = appSandbox;
      }
    }
    catch (e) {
      Components.utils.reportError(e);
    }

    return aFile;
  },

  restart : function(id) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

    // Locate the runtime
    var target = dirSvc.get("XREExeF", Ci.nsIFile);

    var appOverride = this.getInstallRoot();
    appOverride.append(id);
    appOverride.append("override.ini");

    // Launch target with webapp
    process.init(target);
    process.run(false, ["-override", appOverride.path, "-webapp", id], 4);
  },

  createApplication : function(params, clean) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Creating a webapp install requires an ID
    if (params.hasOwnProperty("id") == true && params.id.length > 0) {
      // Now we will build the webapp folder in the profile
      var appSandbox = this.getInstallRoot();
      appSandbox.append(params.id);

      // Remove any existing webapp folder if we want a clean install
      if (appSandbox.exists() && clean)
        appSandbox.remove(true);

      // Make sure the folder exists
      if (!appSandbox.exists())
        appSandbox.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

      var appINI = appSandbox.clone();
      appINI.append("webapp.ini");

      // Save the params to an INI file
      var cmd = "[Parameters]\n";
      cmd += "id=" + params.id + "\n";
      cmd += "name=" + params.name + "\n";
      cmd += "uri=" + params.uri + "\n";
      cmd += "icon=" + WebAppProperties.icon + "\n";
      cmd += "status=" + params.status + "\n";
      cmd += "location=" + params.location + "\n";
      cmd += "sidebar=" + params.sidebar + "\n";
      cmd += "navigation=" + params.navigation + "\n";
      cmd += "trayicon=" + params.trayicon + "\n";
      FileIO.stringToFile(cmd, appINI);

      // Save the params to an override INI file
      var overINI = appSandbox.clone();
      overINI.append("override.ini");
      if (params.hasOwnProperty("group")) {
        cmd = "[App]\n";
        cmd += "Vendor=Prism\n";
        cmd += "Name=" + params.group + "\n";
        FileIO.stringToFile(cmd, overINI);
      }

      // Copy the icon
      var appIcon = appSandbox.clone();
      appIcon.append("icons");
      appIcon.append("default");
      if (!appIcon.exists())
        appIcon.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
      appIcon.append(WebAppProperties.icon + ImageUtils.getNativeIconExtension());

      var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      stream.init(appIcon, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, PR_PERMS_FILE, 0);
      var bufferedStream = Cc["@mozilla.org/network/buffered-output-stream;1"].
                           createInstance(Ci.nsIBufferedOutputStream);
      bufferedStream.init(stream, 1024);

      bufferedStream.writeFrom(params.icon.stream, params.icon.stream.available());
      bufferedStream.close();
    }
  },

  createShortcut : function(name, id, locations) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Locate the webapp folder in the profile
    var appSandbox = this.getInstallRoot();
    appSandbox.append(id);

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
    }

    arguments += "-webapp " + id;

    this._createShortcut(target, name, arguments, workingPath, appSandbox, locations);
  },

#ifdef XP_MACOSX
  _createShortcut : function(target, name, arguments, workingPath, root, locations) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Locate the webapp resources
    var appOverride = root.clone();
    appOverride.append("override.ini");

    arguments = "-override \"" + appOverride.path + "\" " + arguments;
    if (workingPath.length)
      arguments = "-app \"" + workingPath + "/application.ini\" " + arguments;

    var appIcon = root.clone();
    appIcon.append("icons");
    appIcon.append("default");
    appIcon.append(WebAppProperties.icon + ImageUtils.getNativeIconExtension());

    var bundle = null;
    if (locations.indexOf("desktop") > -1) {
      var desk = dirSvc.get("Desk", Ci.nsIFile);
      bundle = this._createBundle(target, name, arguments, appIcon, desk);
    }
    if (locations.indexOf("applications") > -1) {
      var apps = dirSvc.get("LocApp", Ci.nsIFile);
      if (!apps.exists())
        apps.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
      bundle = this._createBundle(target, name, arguments, appIcon, apps);
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
    location.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

    var bundle = location.clone();

    location.append("Contents");
    location.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

    var info = location.clone();
    info.append("Info.plist");
    FileIO.stringToFile(contents, info);

    var resources = location.clone();
    resources.append("Resources");
    resources.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
    icon.copyTo(resources, icon.leafName);

    var macos = location.clone();
    macos.append("MacOS");
    macos.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

    var cmd = "#!/bin/sh\nexec \"" + target.path + "\" " + arguments;
    var script = macos.clone();
    script.append(name);
    FileIO.stringToFile(cmd, script, 0755);

    return bundle;
  },
#else
#ifdef XP_UNIX
  _createShortcut : function(target, name, arguments, workingPath, root, locations) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Locate the webapp resources
    var appOverride = root.clone();
    appOverride.append("override.ini");

    arguments = "-override \"" + appOverride.path + "\" " + arguments;
    if (workingPath.length)
      arguments = "-app \"" + workingPath + "/application.ini\" " + arguments;

    var appIcon = root.clone();
    appIcon.append("icons");
    appIcon.append("default");
    appIcon.append(WebAppProperties.icon + ImageUtils.getNativeIconExtension());

    var file = dirSvc.get("Desk", Ci.nsIFile);
    file.append(name + ".desktop");
    if (file.exists())
      file.remove(false);
    file.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);

    var cmd = "[Desktop Entry]\n";
    cmd += "Name=" + name + "\n";
    cmd += "Type=Application\n";
    cmd += "Comment=Web Application\n";
    cmd += "Exec=\"" + target.path + "\" " + arguments + "\n";
    cmd += "Icon=" + appIcon.path + "\n";

    FileIO.stringToFile(cmd, file);
  },
#else
  _createShortcut : function(target, name, arguments, workingPath, root, locations) {
    var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Locate the webapp resources
    var appOverride = root.clone();
    appOverride.append("override.ini");

    arguments = "-override \"" + appOverride.path + "\" " + arguments;
    if (workingPath.length)
      arguments = "-app application.ini " + arguments;

    var appIcon = root.clone();
    appIcon.append("icons");
    appIcon.append("default");
    appIcon.append(WebAppProperties.icon + ImageUtils.getNativeIconExtension());

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

      desktop.createShortcut(name, target, directory, workingPath, arguments, "", appIcon);
    }
  },
#endif
#endif

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

var FileIO = {
  // Returns the text content of a given nsIFile
  fileToString : function(file) {
    // Get a nsIFileInputStream for the file
    var fis = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    fis.init(file, -1, 0, 0);

    // Get an intl-aware nsIConverterInputStream for the file
    var is = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
    is.init(fis, "UTF-8", 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

    // Read the file into string via buffer
    var data = "";
    var buffer = {};
    while (is.readString(4096, buffer) != 0) {
      data += buffer.value;
    }

    // Clean up
    is.close();
    fis.close();

    return data;
  },

  // Saves the given text string to the given nsIFile
  stringToFile : function(data, file) {
    // Get a nsIFileOutputStream for the file
    var fos = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
    fos.init(file, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, (arguments.length == 3 ? arguments[2] : PR_PERMS_FILE), 0);

    // Get an intl-aware nsIConverterOutputStream for the file
    var os = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
    os.init(fos, "UTF-8", 0, 0x0000);

    // Write data to the file
    os.writeString(data);

    // Clean up
    os.close();
    fos.close();
  }
};
