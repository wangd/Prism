EXPORTED_SYMBOLS = ["ShortcutCreator"];

Components.utils.import("resource://prism/modules/ImageUtils.jsm");
Components.utils.import("resource://prism/modules/WebAppProperties.jsm");
Components.utils.import("resource://prism/modules/consts.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

var ShortcutCreator = {
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

      var shortcut = desktop.createShortcut(name, target, directory, extensionDir ? extensionDir.path : "", arguments, "", appIcon);
      dump("Shortcut path: " + shortcut.path);
      return shortcut;
    }
  }
};
