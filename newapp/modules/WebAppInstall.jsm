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
Components.utils.import("resource://prism/modules/WebAppProperties.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

const PR_WRONLY = 0x02;
const PR_CREATE_FILE = 0x08;
const PR_TRUNCATE = 0x20;

const PR_PERMS_FILE = 0644;
const PR_PERMS_DIRECTORY = 0755;

const PR_UINT32_MAX = 4294967295;

EXPORTED_SYMBOLS = ["WebAppInstall"];

var WebAppInstall =
{
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

  install : function(aFile) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var reader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
    reader.open(aFile);
    reader.test(null);

    // Extract the webapp.ini to a temp location so it can be parsed
    var tempINI = dirSvc.get("TmpD", Ci.nsIFile);
    tempINI.append("webapp.ini");
    tempINI.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
    reader.extract("webapp.ini", tempINI);
    WebAppProperties.readINI(tempINI);
    tempINI.remove(false);

    // Creating a webapp install requires an ID
    if (WebAppProperties.id.length > 0) {
      var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
      var iconExt = ImageUtils.getNativeIconExtension();

      // Now we will unpack the bundle into the webapp folder
      var appSandbox = WebAppProperties.getAppRoot();
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

    return aFile;
  },

  restart : function(id, shortcut) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

    // Locate the runtime
    var target = dirSvc.get("XREExeF", Ci.nsIFile);

    var appOverride = WebAppProperties.getAppRoot();
    appOverride.append("override.ini");

    // Launch target with webapp
#ifdef XP_MACOSX
    process.init(shortcut);
    var restartArgs = [];
#else
    process.init(target);
    var restartArgs = ["-override", appOverride.path, "-webapp", id];
#endif
    process.run(false, restartArgs, restartArgs.length);
  },

  createApplication : function(params, clean) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Creating a webapp install requires an ID
    if (params.hasOwnProperty("id") == true && params.id.length > 0) {
      // Now we will build the webapp folder in the profile
      var appSandbox = WebAppProperties.getAppRoot();

      // Remove any existing webapp folder if we want a clean install
      if (appSandbox.exists() && clean)
        appSandbox.remove(true);

      // Make sure the folder exists
      if (!appSandbox.exists())
        appSandbox.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

      var appINI = appSandbox.clone();
      appINI.append("webapp.ini");

      // If prism was launched with '-webapp <path_to_webapp_bundle>'
      // parameter specified, the 'webapp.ini' file can already exists
      // at this point. If it is the case, make sure it is writable.
      if (appINI.exists() && !appINI.isWritable())
        appINI.QueryInterface(Ci.nsILocalFile).permissions = PR_PERMS_FILE;

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

      // See comments above about permissions.
      if (appIcon.exists() && !appIcon.isWritable())
        appIcon.QueryInterface(Ci.nsILocalFile).permissions = PR_PERMS_FILE;

      var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      stream.init(appIcon, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, PR_PERMS_FILE, 0);
      var bufferedStream = Cc["@mozilla.org/network/buffered-output-stream;1"].
                           createInstance(Ci.nsIBufferedOutputStream);
      bufferedStream.init(stream, 1024);

      bufferedStream.writeFrom(params.icon.stream, params.icon.stream.available());
      bufferedStream.close();
      
#ifdef XP_MACOSX
      // Copy the icon into the bundle as well
      var resources = appSandbox.parent;
      appIcon.copyTo(resources, appIcon.leafName);
#endif
    }
  },

  createShortcut : function(name, id, locations) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Locate the webapp folder in the profile
    var appSandbox = WebAppProperties.getAppRoot();

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

    var extensionDir = null;
    var arguments = "";
    var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
    if (appInfo.name == "Firefox")
    {
      // We use the working path because of a Windows bug that restricts shortcut targets to
      // 260 characters or less.
      extensionDir = this.getExtensionDirectory(dirSvc);
      extensionDir.append("prism");
    }

    arguments += "-webapp " + id;

    return this._createShortcut(target, name, arguments, extensionDir, appSandbox, locations);
  },

#ifdef XP_MACOSX
  _createShortcut : function(target, name, arguments, extensionDir, root, locations) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var bundle = null;
    if (locations.indexOf("desktop") > -1) {
      var desk = dirSvc.get("Desk", Ci.nsIFile);
      bundle = this._createBundle(target, name, arguments, extensionDir, desk);
    }
    if (locations.indexOf("applications") > -1) {
      var apps = dirSvc.get("LocApp", Ci.nsIFile);
      if (!apps.exists())
        apps.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
      bundle = this._createBundle(target, name, arguments, extensionDir, apps);
    }

    // Return the exec script file so it can be spawned (for restart)
    var scriptFile = bundle.clone();
    scriptFile.append("Contents");
    scriptFile.append("MacOS");
    scriptFile.append("prism");

    return scriptFile;
  },

  _createBundle : function(target, name, arguments, extensionDir, location) {
    var contents =
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
    "<!DOCTYPE plist PUBLIC \"-//Apple Computer//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n" +
    "<plist version=\"1.0\">\n" +
    "<dict>\n" +
    "<key>CFBundleIdentifier</key>\n" +
    "<string>org.mozilla.prism." + WebAppProperties.id.substring(0, WebAppProperties.id.indexOf("@")) + "</string>\n" +
    "<key>CFBundleExecutable</key>\n" +
    "<string>prism</string>\n" +
    "<key>CFBundleIconFile</key>\n" +
    "<string>" + WebAppProperties.icon + ImageUtils.getNativeIconExtension() + "</string>\n" +
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
    
    // On Mac, set the app root to the webapp subdirectory of the app bundle
    var appRoot = resources.clone();
    appRoot.append("webapp");
    appRoot.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
    WebAppProperties.appRoot = appRoot;

    var macos = location.clone();
    macos.append("MacOS");
    macos.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

    // Copy the Prism stub into the bundle
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var stub = dirSvc.get("XREExeF", Ci.nsIFile);
    var greHome = stub.parent.parent.clone();
    var prismRoot;
    if (extensionDir) {
      prismRoot = extensionDir;
    }
    else {
      prismRoot = greHome.clone();
      prismRoot.append("Resources");
    }
    
    // Create the locale file with the app name (for the menu bar)
    var infoPlistStrings = resources.clone();
    infoPlistStrings.append("en.lproj");
    infoPlistStrings.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
    infoPlistStrings.append("InfoPlist.strings");
    FileIO.stringToFile("CFBundleName = \"" + name + "\";\n", infoPlistStrings, "UTF-16");

    if (extensionDir) {
      // Can't use the Firefox stub so we need to use the XR stub supplied with the extension
      greHome.append("MacOS");
      stub = prismRoot.clone();
      stub.append("prism");
    }
    else {
      greHome.append("Frameworks");
      greHome.append("XUL.framework");
    }

    stub.copyTo(macos, "prism");

    // Copy application.ini into the bundle
    var applicationIni = prismRoot.clone();
    applicationIni.append("application.ini");

    var iniString = FileIO.fileToString(applicationIni);
    
    applicationIni = resources.clone();
    applicationIni.append("application.ini");
    iniString += "\n[Environment]\nGRE_HOME=" + greHome.path + "\nPRISM_HOME=" + prismRoot.path + "\n";
    FileIO.stringToFile(iniString, applicationIni);

    // Create the branding files and chrome overrides
    this._createBrandingFiles(resources, name);

    return bundle;
  },

  _createBrandingFiles : function(resources, name) {
    var branding = resources.clone();
    branding.append("branding");
    branding.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

    // Create DTD
    var dtd = "<!ENTITY brandShortName \"" + name + "\">\n<!ENTITY brandFullName \"" + name + "\">\n";
    var dtdFile = branding.clone();
    dtdFile.append("brand.dtd");
    FileIO.stringToFile(dtd, dtdFile);

    // Create properties
    var properties = "brandShortName=" + name + "\nbrandFullName=" + name + "\n";
    var propertiesFile = branding.clone();
    propertiesFile.append("brand.properties");
    FileIO.stringToFile(properties, propertiesFile);
  },
#else
#ifdef XP_UNIX
  _createShortcut : function(target, name, arguments, extensionDir, root, locations) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Locate the webapp resources
    var appOverride = root.clone();
    appOverride.append("override.ini");

    arguments = "-override \"" + appOverride.path + "\" " + arguments;
    if (extensionDir)
      arguments = "-app \"" + extensionDir.path + "/application.ini\" " + arguments;

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

    return file;
  },
#else
  _createShortcut : function(target, name, arguments, extensionDir, root, locations) {
    var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Locate the webapp resources
    var appOverride = root.clone();
    appOverride.append("override.ini");

    arguments = "-override \"" + appOverride.path + "\" " + arguments;
    if (extensionDir)
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

      return desktop.createShortcut(name, target, directory, extensionDir ? extensionDir.path : "", arguments, "", appIcon);
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
  },
};
