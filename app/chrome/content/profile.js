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
 *   Wladimir Palant <trev@adblockplus.org>
 *   Mark Finkle, <mark.finkle@gmail.com>, <mfinkle@mozilla.com>
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Constructs an nsISimpleEnumerator for the given array of items.
 */
function ArrayEnumerator(items) {
  this._items = items;
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

function IconProvider(folder) {
  this._folder = folder;
}

IconProvider.prototype = {
  getFile: function(prop, persistent) {
    throw Components.results.NS_ERROR_FAILURE;
  },

  getFiles: function(prop, persistent) {
    if (prop == NS_APP_CHROME_DIR_LIST) {
      return new ArrayEnumerator([this._folder]);
    }
    throw Components.results.NS_ERROR_FAILURE;
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


/**
 * Profile object provides access to web applications profile bundle.
 * It handles unpacking the bundle to the profile folder. Then it parses
 * the parameters and loads the script.
 */
function Profile(cl)
{
  if (!cl)
    return;

  // check for a webapp profile
  var file = cl.handleFlagWithParam("webapp", false);
  if (file)
    file = cl.resolveFile(file);

  // check for an OSX launch
  if (!file) {
    var uri = cl.handleFlagWithParam("url", false);
    if (uri) {
      uri = cl.resolveURI(uri);
      file = uri.QueryInterface(Ci.nsIFileURL).file;
    }
  }

  if (file)
    this.readFile(file);

  this.readCommandLine(cl);
}

Profile.prototype = {
  script : {},
  uri : "chrome://webrunner/locale/welcome.html",
  icon : "webrunner",
  showstatus : true,
  showlocation : false,
  enablenavigation : true,

  setParameter: function(name, value) {
    if (["uri", "icon", "showstatus", "showlocation", "enablenavigation"].indexOf(name) == -1)
      return;

    if (typeof this[name] != "string" && typeof this[name] != "boolean")
      return;

    if (typeof this[name] == "boolean")
      value = (value.toLowerCase() == "true" || value.toLowerCase() == "yes");

    this[name] = value;
  },

  readFile: function(file)
  {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var appINI = dirSvc.get("ProfD", Ci.nsIFile);
    appINI.append("webapp");
    appINI.append("webapp.ini");
    if (appINI.exists())
      appINI.remove(false);
    appINI.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

    try {
      var reader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
      reader.open(file);
      reader.test(null);
      reader.extract("webapp.ini", appINI);

      var iniFactory = Components.manager.getClassObjectByContractID("@mozilla.org/xpcom/ini-parser-factory;1", Ci.nsIINIParserFactory);
      var iniParser = iniFactory.createINIParser(appINI);

      var keys = iniParser.getKeys("Parameters");
      while (keys.hasMore()) {
        var key = keys.getNext();
        var value = iniParser.getString("Parameters", key);
        Components.utils.reportError(key + ": " + value);
        this.setParameter(key.toLowerCase(), value);
      }

      var appScript = dirSvc.get("ProfD", Ci.nsIFile);
      appScript.append("webapp");
      appScript.append("webapp.js");
      if (appScript.exists())
        appScript.remove(false);
      appScript.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
      reader.extract("webapp.js", appScript);

      var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      var appScriptURI = ios.newFileURI(appScript);

      var scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
      scriptLoader.loadSubScript(appScriptURI.spec, this.script);

      if (this.icon != "webrunner") {
        var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
        var iconExt = "";
        if (xulRuntime.OS.toLowerCase() == "winnt")
          iconExt = ".ico";
        else if (xulRuntime.OS.toLowerCase() == "linux")
          iconExt = ".xpm";
        else if (xulRuntime.OS.toLowerCase() == "darwin")
          iconExt = ".icns";

        var appIcon = dirSvc.get("ProfD", Ci.nsIFile);
        appIcon.append("webapp");
        var appIconFolder = appIcon.clone();
        appIcon.append("icons");
        appIcon.append("default");
        appIcon.append(this.icon + iconExt);
        if (appIcon.exists())
          appIcon.remove(false);
        appIcon.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
        reader.extract(this.icon + iconExt, appIcon);

        var iconProvider = new IconProvider(appIconFolder);
        var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
        dirSvc.QueryInterface(Ci.nsIDirectoryService).registerProvider(iconProvider);
      }
    }
    catch (e) {
      Components.utils.reportError(e);
    }
  },

  readCommandLine: function(cl)
  {
    for (var key in this) {
      var value = cl.handleFlagWithParam(key, false);
      if (value != null)
        this.setParameter(key, value);
    }
  }
}
