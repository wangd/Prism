/******************************************************************************
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Prism Extension.
 *
 * The Initial Developer of the Original Code is  is Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Cesar Oliveira <a.sacred.line@gmail.com>
 *   Matthew Gertner <matthew@allpeers.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *****************************************************************************/

Components.utils.import("resource://prism/modules/WebAppInstall.jsm");
Components.utils.import("resource://prism/modules/WebAppProperties.jsm");

var Prism = {
  convertToApplication : function(useDocumentHref) {
    if (useDocumentHref) {
      WebAppProperties.uri = gBrowser.contentDocument.location.href;
      WebAppProperties.appBundle = null;
    }

    var allowLaunch = {value: false};
    window.openDialog("chrome://refractor/content/install-shortcut.xul", "install", "centerscreen,modal", WebAppProperties, allowLaunch);
  },
  onLoad : function() {
    var uriloader = Cc["@mozilla.org/uriloader;1"].getService(Ci.nsIURILoader);
    uriloader.registerContentListener(PrismContentListener);

    gBrowser.addProgressListener(PrismWebListener);
  }
};

var PrismWebAppDownload = {
  targetFile : null,

  QueryInterface : function(iid) {
    if (iid.equals(Ci.nsISupports) ||
      iid.equals(Ci.nsIWebProgressListener) ||
      iid.equals(Ci.nsIDownloadObserver)) {
      return this;
    }
    return Components.results.NS_NOINTERFACE;
  },

  download : function(uri) {
    /* Some of this code stolen from :
     * http://mxr.mozilla.org/seamonkey/source/toolkit/components/downloads/test/unit/test_resume.js#157
     * Thanks Mardak!
     */

    var persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
    var io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

    this.targetFile = this.getTemporaryFileForUri(uri);

    persist.persistFlags = Ci.nsIWebBrowserPersist.PERSIST_FLAGS_NONE |
      Ci.nsIWebBrowserPersist.PERSIST_FLAGS_FAIL_ON_BROKEN_LINKS |
      Ci.nsIWebBrowserPersist.PERSIST_FLAGS_CLEANUP_ON_FAILURE;
    persist.progressListener = this;

    persist.saveURI(uri, null, null, null, null, this.targetFile);
  },

  install : function(file) {
    var packageDir = WebAppInstall.install(file);
    WebAppProperties.init(packageDir);
    Prism.convertToApplication(false);
  },

  getTemporaryFileForUri : function(uri)
  {
    var tempDir =
      Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
    var file = tempDir;
    file.append(uri.QueryInterface(Ci.nsIURL).fileName);
    if (file.exists()) {
      file.remove(true);
    }
    file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);

    return file;
  },

  onLocationChange : function(webProgress, request, location) { },
  onProgressChange : function(webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) { },
  onSecurityChange : function(webProgress, request, state) { },

  onStateChange : function(webProgress, request, stateFlags, status) {
    if (stateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
      this.install(this.targetFile);
    }
  },

  onStatusChange : function(webProgress, request, status, message) { },

  onDownloadComplete : function(downloader, request, ctxt, status, result) {
    this.install(result);
  }
};

function PrismWebApps(theDocument)
{
  this.webappCount = 0;
  this.strings = document.getElementById("prism_strings");
  theDocument.addEventListener("DOMLinkAdded", this, false);
  theDocument.addEventListener("DOMContentLoaded", this, false);
}

PrismWebApps.prototype = {
  handleEvent : function(event)
  {
    switch(event.type) {
      case "DOMLinkAdded":
        this.onLinkAdded(event);
        break;
      case "DOMContentLoaded":
        this.onContentLoaded(event);
        break;
      case "popupshowing":
        this.fillPopupList(event);
        break;
      case "command":
        this.installWebApp(event);
        break;
    }
  },

  onLinkAdded : function(event) {
    var tag = event.originalTarget;
    if (tag.rel.toLowerCase() == "webapp")
      this.webappCount++;
  },

  onContentLoaded : function(event) {
    var notificationbox = gBrowser.getNotificationBox();
    if (this.webappCount > 0 && notificationbox.getNotificationWithValue("refractor") == null) {
      document.getElementById("prismNotificationPopup").addEventListener("popupshowing", this, false);
      notificationbox.appendNotification(
        this.strings.getString("prismNotificationText"),
        "refractor",
        "chrome://refractor/skin/webrunner48.png",
        notificationbox.PRIORITY_INFO_LOW,
        [ { accessKey: null,
            callback: null,
            label: this.strings.getString("prismNotificationButton"),
            popup: "prismNotificationPopup" }
        ]
      );
    }
  },

  fillPopupList : function(event)
  {
    var popup = event.target;

    while (popup.firstChild)
      popup.removeChild(popup.firstChild);

    var links = gBrowser.contentDocument.getElementsByTagName("link");

    for (var i=0; i<links.length; i++) {
      if (links[i].rel == "webapp") {
        var menuitem = document.createElement("menuitem");
        var label = this.strings.getFormattedString("prismNotificationMenu", [ links[i].getAttribute("title") ]);
        menuitem.setAttribute("label", label);
        menuitem.value = links[i].href;
        menuitem.addEventListener("command", this, false);
        popup.appendChild(menuitem);
      }
    }
  },

  installWebApp : function(event)
  {
    var webappSpec = event.target.value;
    var io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var webappUri = io.newURI(webappSpec, "", event.originalTarget.baseURIObject);

    PrismWebAppDownload.download(webappUri);
  }
};

var PrismWebListener = {
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIWebProgressListener) ||
        iid.equals(Components.interfaces.nsISupportsWeakReference) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_NOINTERFACE;
  },

  onLocationChange : function (webProgress, request, loc) {
    // Make sure that this is really a new request (and not changing tabs or something)
    if (request) {
      new PrismWebApps(webProgress.DOMWindow.document);
    }
  },

  onProgressChange : function() {},
  onSecurityChange : function() {},
  onStateChange : function() {},
  onStatusChange : function() {}
};

var PrismContentListener = {
  contentType : "application/x-webapp",

  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIURIContentListener) ||
        iid.equals(Components.interfaces.nsISupportsWeakReference) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_NOINTERFACE;
  },

  onStartURIOpen: function(uri) {
    return false;
  },

  doContent: function(contentType, isContentPreferred, request, contentHandler) {
    var downloader = Cc["@mozilla.org/network/downloader;1"].createInstance(Ci.nsIDownloader);

    var io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var webappUri = io.newURI(request.name, "", null);
    var targetFile = PrismWebAppDownload.getTemporaryFileForUri(webappUri);

    downloader.init(PrismWebAppDownload, targetFile);
    contentHandler.value = downloader;

    return false;
  },

  isPreferred: function(contentType, desiredContentType) {
    if (contentType == this.contentType) {
      return true;
    }
    return false;
  },

  canHandleContent: function(contentType, isContentPreferred, desiredContentType) {
    if (contentType == this.contentType) {
      return true;
    }
    return false;
  }
};

window.addEventListener("load", Prism.onLoad, false);
