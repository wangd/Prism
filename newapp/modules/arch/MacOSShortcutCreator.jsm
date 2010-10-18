EXPORTED_SYMBOLS = ["ShortcutCreator"];

Components.utils.import("resource://prism/modules/ImageUtils.jsm");
Components.utils.import("resource://prism/modules/WebAppProperties.jsm");
Components.utils.import("resource://prism/modules/consts.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

var ShortcutCreator = {
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
        greHome.append("MacOS");

        // Copy in dependentlibs.list if necessary (see bug 542004)
        var dependentlibs = greHome.clone();
        dependentlibs.append("dependentlibs.list");
        if (!dependentlibs.exists()) {
          dependentlibs = prismRoot.clone();
          dependentlibs.append("dependentlibs.list");
          dependentlibs.copyTo(greHome, null);
        }

        // Can't use the Firefox stub so we need to use the XR stub supplied with the extension
        stub = prismRoot.clone();
        stub.append("prism");
      }
      else {
        greHome.append("Frameworks");
        greHome.append("XUL.framework");
      }

      stub.copyTo(macos, "prism");
      macos.append("prism");
      macos.permissions = 0755;
      
      this._createAppIniFile(prismRoot, greHome, resources);

      // Create the branding files and chrome overrides
      this._createBrandingFiles(resources, name);

      return bundle;
    },
    
    _createAppIniFile: function WAI__create_ini_string(prismRoot, greHome, resources) {
      // Copy application.ini into the bundle
      var applicationIni = prismRoot.clone();
      applicationIni.append("application.ini");

      var iniString = FileIO.fileToString(applicationIni);
      
      applicationIni = resources.clone();
      applicationIni.append("application.ini");
      iniString += "\n[Environment]\nGRE_HOME=" + greHome.path + "\nPRISM_HOME=" + prismRoot.path + "\n";
      FileIO.stringToFile(iniString, applicationIni);
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
    }
};