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
const PR_UINT32_MAX = 4294967295;

Components.utils.import("resource://app/modules/ImageUtils.jsm");
Components.utils.import("resource://app/modules/WebAppInstall.jsm");
Components.utils.import("resource://app/modules/FaviconDownloader.jsm");

var InstallShortcut = {
  _userIcon : null,
  _iframe : null,

  init : function() {
    // Check the dialog mode
    if (window.arguments) {
      var self = this;

      // Default the UI from the given config
      if (window.arguments[0].uri) {
        document.getElementById("uri").value = window.arguments[0].uri;
        document.getElementById("name").focus();
      }

      // Default to use the favicon
      document.getElementById("icon_favicon").setAttribute("checked", "true");

      if (window.arguments.length == 2) {
        var bundle = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
        bundle = bundle.createBundle("chrome://webrunner/locale/install-shortcut.properties");
        document.title = bundle.GetStringFromName("dialog.title");
        document.getElementById("row_uri").hidden = false;
        document.getElementById("options").hidden = false;

        document.getElementById("status").checked = window.arguments[0].status;
        document.getElementById("location").checked = window.arguments[0].location;
        document.getElementById("navigation").checked = window.arguments[0].navigation;


        document.getElementById("uri").addEventListener("change", function() { self.onUriChange(); }, false);

        window.arguments[1].value = true;
      }
      else {
          // We are hiding the URL textbox, but still need to fire the icon preview
          setTimeout(function() { self.onUriChange(); }, 0);
      }
    }

    // Configure the options based on the OS
    // FIXME: Use XUL Preprocessor?
    var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    var os = xulRuntime.OS.toLowerCase();
    if (os == "winnt") {
      document.getElementById("applications").hidden = true;
      document.getElementById("dock").hidden = true;
    }
    else if (os == "linux") {
      document.getElementById("programs").hidden = true;
      document.getElementById("quicklaunch").hidden = true;
      document.getElementById("trayicon").hidden = true;

      document.getElementById("applications").hidden = true;
      document.getElementById("dock").hidden = true;
    }
    else if (os == "darwin") {
      document.getElementById("programs").hidden = true;
      document.getElementById("quicklaunch").hidden = true;
      document.getElementById("trayicon").hidden = true;
    }
  },

  cleanup: function() {
    if (this._iframe)
    {
      this._iframe.removeEventListener("DOMLinkAdded", FaviconDownloader, false);
      this._iframe.removeEventListener("DOMContentLoaded", FaviconDownloader, false);
    }
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
    if (document.getElementById("dock").checked)
      shortcuts += "dock,";

    if (shortcuts.length == 0) {
      alert(bundle.GetStringFromName("shortcuts.missing"));
      return false;
    }

    var programs = document.getElementById("programs");
    if (window.arguments) {
      if (window.arguments.length == 2) {
        var uri = document.getElementById("uri");
        var doLocation = document.getElementById("location").checked ? true : false;
        var doStatus = document.getElementById("status").checked ? true : false;
        var doNavigation = document.getElementById("navigation").checked ? true : false;
        var doTrayIcon = document.getElementById("trayicon").checked ? true : false;
        var idPrefix = name.toLowerCase();
        idPrefix = idPrefix.replace(" ", ".", "g");

        // Get the icon stream which is either the default icon or the favicon
        var iconData = this.getIcon();
        var params = {id: idPrefix + "@prism.app", uri: uri.value, icon: iconData, status: doStatus, location: doLocation, sidebar: "false", navigation: doNavigation, trayicon: doTrayIcon};

        // Make the web application in the profile folder
        WebAppInstall.createApplication(params);

        // Update the caller's config
        window.arguments[0].id = params.id;
        window.arguments[0].uri = params.uri;
        window.arguments[0].icon = "webrunner";
        window.arguments[0].status = params.status;
        window.arguments[0].location = params.location;
        window.arguments[0].navigation = params.navigation;
        window.arguments[0].trayicon = params.trayicon;

        // Let the caller know we actually installed a web application
        window.arguments[1].value = false;
      }

      // Make any desired shortcuts
      WebAppInstall.createShortcut(name, window.arguments[0].id, shortcuts);
    }
    return true;
  },

  getIcon : function()
  {
    var icon = { mimeType: null, stream: null };

    if (this._userIcon) {
      icon.mimeType = this._userIcon.mimeType;
      icon.stream = this._userIcon.storage.newInputStream(0);
      return icon;
    }

    var favicon = FaviconDownloader.getGeneratedImage();
    if (favicon) {
      icon.stream = favicon;
      icon.mimeType = FaviconDownloader.mimeType;
      return icon;
    }

    var iconName ="app" + ImageUtils.getNativeIconExtension();
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var defaultIcon = dirSvc.get("resource:app", Ci.nsIFile);
    defaultIcon.append("chrome");
    defaultIcon.append("icons");
    defaultIcon.append("default");
    defaultIcon.append(iconName);

    var inputStream = Cc["@mozilla.org/network/file-input-stream;1"].
                      createInstance(Ci.nsIFileInputStream);
    inputStream.init(defaultIcon, 0x01, 00004, null);

    icon.stream = inputStream;
    icon.mimeType = ImageUtils.getNativeIconMimeType();
    return icon;
  },

  onUriChange : function(event)
  {
    // Show the user that we are doing something
    image = document.getElementById("icon");
    image.setAttribute("src", "chrome://global/skin/throbber/Throbber-small.gif");

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

    // Prepare the URI to look for favicon
    var uriFixup = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
    var uri = uriFixup.createFixupURI(document.getElementById("uri").value, Ci.nsIURIFixup.FIXUP_FLAG_NONE);

    // Hook the iframe events to the favicon loader
    this._iframe.addEventListener("DOMLinkAdded", FaviconDownloader, false);
    this._iframe.addEventListener("DOMContentLoaded", FaviconDownloader, false);

    // Load the web content into the iframe, which also starts the favicon download
    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var channel = ioService.newChannelFromURI(uri);
    var uriLoader = Cc["@mozilla.org/uriloader;1"].getService(Ci.nsIURILoader);
    uriLoader.openURI(channel, true, this._iframe.docShell);

    var self = this;
    FaviconDownloader.callback = function() { self.onIconReady(); };
  },

  onIconReady : function() {
    var icon = this.getIcon();
    var iconDataURI = ImageUtils.makeDataURL(icon.stream, icon.mimeType);
    image = document.getElementById("icon");
    image.setAttribute("src", iconDataURI);
  },

  useFavicon : function() {
    this._userIcon = null;
    this.onIconReady();
  },

  useFile : function() {
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);

    var bundle = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
    bundle = bundle.createBundle("chrome://webrunner/locale/install-shortcut.properties");
    var title = bundle.GetStringFromName("iconDialog.title");
    fp.init(window, title, Ci.nsIFilePicker.modeOpen);

    fp.appendFilters(Ci.nsIFilePicker.filterImages);
    if (fp.show() == Ci.nsIFilePicker.returnOK) {
      var inputStream = Cc["@mozilla.org/network/file-input-stream;1"].
                        createInstance(Ci.nsIFileInputStream);
      inputStream.init(fp.file, 0x01, 00004, null);

      var fileName = fp.file.leafName;
      var fileExt = fileName.substring(fileName.lastIndexOf("."), fileName.length).toLowerCase();
      var fileMimeType = ImageUtils.getMimeTypeFromExtension(fileExt);

      // The image decoders use ReadSegments, which isn't implemented on
      // file input streams. Use a buffered stream to make it work.
      var bis = Cc["@mozilla.org/network/buffered-input-stream;1"].
                createInstance(Ci.nsIBufferedInputStream);
      bis.init(inputStream, 1024);

      var storageStream = Cc["@mozilla.org/storagestream;1"].createInstance(Ci.nsIStorageStream);
      storageStream.init(4096, PR_UINT32_MAX, null);

      var bss = Cc["@mozilla.org/network/buffered-output-stream;1"].
                createInstance(Ci.nsIBufferedOutputStream);
      bss.init(storageStream.getOutputStream(0), 1024);

      ImageUtils.createNativeIcon(bis, fileMimeType, bss);

      this._userIcon = { mimeType: fileMimeType, storage: storageStream };
      this.onIconReady();
    }
  }
};
