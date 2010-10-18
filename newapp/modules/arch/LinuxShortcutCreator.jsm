EXPORTED_SYMBOLS = ["ShortcutCreator"];

Components.utils.import("resource://prism/modules/ImageUtils.jsm");
Components.utils.import("resource://prism/modules/WebAppProperties.jsm");
Components.utils.import("resource://prism/modules/consts.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

var ShortcutCreator = {
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
  }
};