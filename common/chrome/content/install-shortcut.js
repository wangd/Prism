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
 *   Mark Finkle, <mark.finkle@gmail.com>, <mfinkle@mozilla.com>
 *   Matthew Gertner <matthew@allpeers.com>
 *
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://app/modules/ImageUtils.jsm");
Components.utils.import("resource://app/modules/WebAppInstall.jsm");
Components.utils.import("resource://app/modules/FaviconDownloader.jsm");

var InstallShortcut = {
  _iframe : null,

  init : function() {
    // Check the dialog mode
    if (window.arguments && window.arguments.length == 2) {
      var bundle = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
      bundle = bundle.createBundle("chrome://webrunner/locale/install-shortcut.properties");
      document.title = bundle.GetStringFromName("dialog.title");
      document.getElementById("row_uri").hidden = false;
      document.getElementById("options").hidden = false;

      // Default the UI from the given config
      if (window.arguments[0].uri) {
        document.getElementById("uri").value = window.arguments[0].uri;
        document.getElementById("name").focus();
      }
      document.getElementById("status").checked = window.arguments[0].status;
      document.getElementById("location").checked = window.arguments[0].location;
      document.getElementById("navigation").checked = window.arguments[0].navigation;

      window.arguments[1].value = true;
    }

    var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    var os = xulRuntime.OS.toLowerCase();
    if (os == "winnt") {
      document.getElementById("applications").hidden = true;
      document.getElementById("dock").hidden = true;
    }
    else if (os == "linux") {
      document.getElementById("programs").hidden = true;
      document.getElementById("quicklaunch").hidden = true;

      document.getElementById("applications").hidden = true;
      document.getElementById("dock").hidden = true;
    }
    else if (os == "darwin") {
      document.getElementById("programs").hidden = true;
      document.getElementById("quicklaunch").hidden = true;

      // Until we get it working
      document.getElementById("dock").hidden = true;
    }

    document.getElementById("uri").addEventListener("change", this.onUriChange, false);
  },

  cleanup: function() {
    if (this._iframe)
    {
      this._iframe.removeEventListener("DOMLinkAdded", FaviconDownloader);
      this._iframe.removeEventListener("DOMContentLoaded", FaviconDownloader);
    }

    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var favicon = dirSvc.get("ProfD", Ci.nsIFile);
    favicon.append("favicon" + ImageUtils.getNativeIconExtension());
    if (favicon.exists())
      favicon.remove(false);
  },

  accept : function() {
    var bundle = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
    bundle = bundle.createBundle("chrome://webrunner/locale/install-shortcut.properties");

    var name = document.getElementById("name").value;

    // Trim leading / trailing spaces
    name = name.replace(/^\s+/, "").replace(/\s+$/, "");
    if (name.length == 0) {
      document.getElementById("name").focus();
      alert(bundle.GetStringFromName("name.missing"));
      return false;
    }

    // Check for invalid characters (mainly Windows)
    if (/([\\*:?<>|\/\"])/.test(name)) {
      document.getElementById("name").focus();
      alert(bundle.GetStringFromName("name.invalid"));
      return false;
    }

    var shortcuts = "";
    if (document.getElementById("desktop").checked)
      shortcuts += "desktop,";
    if (document.getElementById("programs").checked)
      shortcuts += "programs,";
    if (document.getElementById("quicklaunch").checked)
      shortcuts += "quicklaunch,";
    if (document.getElementById("applications").checked)
      shortcuts += "applications,";

    if (shortcuts.length == 0) {
      alert(bundle.GetStringFromName("shortcuts.missing"));
      return false;
    }

    var programs = document.getElementById("programs");
    if (window.arguments) {
      var appIcon = null;
      if (window.arguments.length == 2) {
        var uri = document.getElementById("uri");
        var doLocation = document.getElementById("location").checked ? true : false;
        var doStatus = document.getElementById("status").checked ? true : false;
        var doNavigation = document.getElementById("navigation").checked ? true : false;
        var idPrefix = name.toLowerCase();
        idPrefix = idPrefix.replace(" ", ".", "g");

        var uriFixup = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
        var iconUri = uriFixup.createFixupURI(document.getElementById("uri").value, Ci.nsIURIFixup.FIXUP_FLAG_NONE);
        var icon = this.getIconForUri(iconUri);

        var params = {id: idPrefix + "@prism.app", uri: uri.value, icon: icon, status: doStatus, location: doLocation, sidebar: "false", navigation: doNavigation};

        // Make the web application in the profile folder
        appIcon = WebAppInstall.createApplication(params);

        // Update the caller's config
        window.arguments[0].id = params.id;
        window.arguments[0].uri = params.uri;
        window.arguments[0].icon = params.icon;
        window.arguments[0].status = params.status;
        window.arguments[0].location = params.location;
        window.arguments[0].navigation = params.navigation;

        // Let the caller know we actually installed a web application
        window.arguments[1].value = false;
      }

      // Make any desired shortcuts
      WebAppInstall.createShortcut(name, window.arguments[0].id, appIcon, shortcuts);
    }
    return true;
  },

  getIconForUri : function(uri)
  {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var favicon = dirSvc.get("ProfD", Ci.nsIFile);
    favicon.append("favicon" + ImageUtils.getNativeIconExtension());
    if (favicon.exists())
      return favicon;

    var iconName ="app" + ImageUtils.getNativeIconExtension();
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var defaultIcon = dirSvc.get("resource:app", Ci.nsIFile);
    defaultIcon.append("chrome");
    defaultIcon.append("icons");
    defaultIcon.append("default");
    defaultIcon.append(iconName);
    return defaultIcon;
  },

  onUriChange : function(event)
  {
    // Try to get the page and see if there is a <link> tag for the favicon
    if (!this._iframe)
    {
      this._iframe = document.createElement("iframe");
      this._iframe.setAttribute("collapsed", true);
      this._iframe.setAttribute("type", "content");

      document.documentElement.appendChild(this._iframe);
    }

    // If anything is loading in the iframe, stop it
    // This includes about:blank if we just created the iframe
    var webNav = this._iframe.docShell.QueryInterface(Ci.nsIWebNavigation);
    webNav.stop(Ci.nsIWebNavigation.STOP_NETWORK);

    this._iframe.docShell.allowJavascript = false;
    this._iframe.docShell.allowAuth = false;
    this._iframe.docShell.allowPlugins = false;
    this._iframe.docShell.allowMetaRedirects = false;
    this._iframe.docShell.allowSubframes = false;
    this._iframe.docShell.allowImages = false;

    var uriFixup = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
    var uri = uriFixup.createFixupURI(document.getElementById("uri").value, Ci.nsIURIFixup.FIXUP_FLAG_NONE);
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var tempDir = dirSvc.get("ProfD", Ci.nsIFile);
    FaviconDownloader.init(uri, tempDir);

    this._iframe.addEventListener("DOMLinkAdded", FaviconDownloader, false);
    this._iframe.addEventListener("DOMContentLoaded", FaviconDownloader, false);
    var uriLoader = Cc["@mozilla.org/uriloader;1"].getService(Ci.nsIURILoader);

    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var channel = ioService.newChannelFromURI(uri);
    uriLoader.openURI(channel, true, this._iframe.docShell);
  }
};