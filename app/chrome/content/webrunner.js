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
 *   Wladimir Palant <trev@adblockplus.org>
 *   Sylvain Pasche <sylvain.pasche@gmail.com>
 *
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;

window.addEventListener("load", function() { WebRunner.startup(); }, false);
window.addEventListener("unload", function() { WebRunner.shutdown(); }, false);


var WebRunner = {
  _params : null,
  _ios : null,

  _getBrowser : function() {
    return document.getElementById('main-browser');
  },
  
  _popupShowing : function(aEvent) {
    var cut = document.getElementById("cmd_cut");
    var copy = document.getElementById("cmd_copy");
    var paste = document.getElementById("cmd_paste");
    var del = document.getElementById("cmd_delete");
  
    var isContentSelected = !document.commandDispatcher.focusedWindow.getSelection().isCollapsed;
  
    var target = document.popupNode;
    var isTextField = target instanceof HTMLTextAreaElement;
    if (target instanceof HTMLInputElement && (target.type == "text" || target.type == "password"))
      isTextField = true;
    var isTextSelectied= (isTextField && target.selectionStart != target.selectionEnd);
  
    cut.setAttribute("disabled", ((!isTextField || !isTextSelectied) ? "true" : "false"));
    copy.setAttribute("disabled", (((!isTextField || !isTextSelectied) && !isContentSelected) ? "true" : "false"));
    paste.setAttribute("disabled", (!isTextField ? "true" : "false"));
    del.setAttribute("disabled", (!isTextField ? "true" : "false"));
  },

  _domTitleChanged : function(aEvent) {
    if (aEvent.target != this._getBrowser().contentDocument)
      return;
  
    document.title = aEvent.target.title;
  },

  _isLinkExternal : function(link) {
    if (link instanceof HTMLAnchorElement) {
      if (link.target == "_self" || link.target == "_top")
        return false;

      var currentURL = this._ios.newURI(link.href, null, null).QueryInterface(Ci.nsIURL);
      var commonBase = currentURL.getCommonBaseSpec(this._getBrowser().currentURI);
      return (commonBase.length == 0);
    }
    return true;
  },
  
  _domClick : function(aEvent)
  {
    var link = aEvent.target;
  
    if (link instanceof HTMLAnchorElement && this._isLinkExternal(link)) {
      aEvent.stopPropagation();
    }
  },
  
  _domActivate : function(aEvent)
  {
    var link = aEvent.target;
  
    if (link instanceof HTMLAnchorElement && this._isLinkExternal(link)) {
      // We don't want to open external links in this process: do so in the
      // default browser.
      var resolvedURI = this._ios.newURI(link.href, null, null);
  
      var extps = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
  
      extps.loadURI(resolvedURI, null);
      aEvent.preventDefault();
      aEvent.stopPropagation();
    }
  },
  
  get params() {
    return this._params;
  },

  startup : function()
  {
    this._ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

    if (window.arguments && window.arguments[0]) {
      this._params = new Params(window.arguments[0].QueryInterface(Ci.nsICommandLine));

      // Set the windowtype attribute here, so we always know which window is the main window
      document.documentElement.setAttribute("windowtype", "webrunner:main");
    }
    else {
      var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
      var win = wm.getMostRecentWindow("webrunner:main");
      if (win && win.WebRunner) {
        this._params = win.WebRunner.params;
        this._params.uri = null;
      }
      else {
        this._params = new Params(null);
      }
    }
  
    // process commandline parameters
    document.documentElement.setAttribute("id", this._params.icon);
    document.getElementById("statusbar").hidden = !this._params.showstatus;
    document.getElementById("locationbar").hidden = !this._params.showlocation;
  
    if (!this._params.enablenavigation) {
      // remove navigation key from the document
      var keys = document.getElementsByTagName("key");
      for (var i = keys.length - 1; i >= 0; i--)
        if (keys[i].className == "nav")
          keys[i].parentNode.removeChild(keys[i]);
    }
  
    // hookup the browser window callbacks
    window.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIWebNavigation)
          .QueryInterface(Ci.nsIDocShellTreeItem)
          .treeOwner
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIXULWindow)
          .XULBrowserWindow = BrowserWindow;
  
    var self = this;
    
    var browser = this._getBrowser();
    browser.addEventListener("DOMTitleChanged", function(aEvent) { self._domTitleChanged(aEvent); }, true)
    browser.webProgress.addProgressListener(BrowserProgressListener, Ci.nsIWebProgress.NOTIFY_ALL);
    
    if (this._params.uri)
      browser.loadURI(this._params.uri, null, null);
  
    var browserContext = document.getElementById("main-popup");
    browserContext.addEventListener("popupshowing", self._popupShowing, false);
    
    var fileMenu = document.getElementById("menu_file");
    if (fileMenu)
      fileMenu.hidden = true;
  },
  
  shutdown : function()
  {
  },
  
  doCommand : function(cmd) {
    switch (cmd) {
      case "cmd_cut":
      case "cmd_copy":
      case "cmd_paste":
      case "cmd_delete":
      case "cmd_selectAll":
        goDoCommand(cmd);
        break;
      case "cmd_print":
        PrintUtils.print();
        break;
      case "cmd_pageSetup":
        PrintUtils.showPageSetup();
        break;
      case "cmd_about":
        window.openDialog("chrome://webrunner/content/about.xul", "about", "centerscreen,modal");
        break;
      case "cmd_back":
        this._getBrowser().goBack();
        break;
      case "cmd_forward":
        this._getBrowser().goForward();
        break;
      case "cmd_home":
        this._getBrowser().loadURI(this._params.uri, null, null);
        break;
      case "cmd_close":
        close();
        break;
      case "cmd_quit":
        goQuitApplication();
        break;
    }
  },
  
  attachDocument : function(doc) {
    var self = this;
    doc.addEventListener("click", function(aEvent) { self._domClick(aEvent); }, true);
    doc.addEventListener("DOMActivate", function(aEvent) { self._domActivate(aEvent); }, true);
  }
};

// nsIXULBrowserWindow implementation to display link destinations in the statusbar
var BrowserWindow = {
  QueryInterface: function(aIID) {
    if (aIID.Equals(Ci.nsIXULBrowserWindow) ||
        aIID.Equals(Ci.nsISupports))
     return this;

    throw Components.results.NS_NOINTERFACE;
  },

  setJSStatus: function() { },
  setJSDefaultStatus: function() { },

  setOverLink: function(aStatusText, aLink) {
    var statusbar = document.getElementById("status");
    statusbar.label = aStatusText;
  }
};


// nsIWebProgressListener implementation to monitor activity in the browser.
var BrowserProgressListener = {
  _requestsStarted: 0,
  _requestsFinished: 0,

  // We need to advertize that we support weak references.  This is done simply
  // by saying that we QI to nsISupportsWeakReference.  XPConnect will take
  // care of actually implementing that interface on our behalf.
  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsIWebProgressListener) ||
        iid.equals(Ci.nsISupportsWeakReference) ||
        iid.equals(Ci.nsISupports))
      return this;
    
    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  // This method is called to indicate state changes.
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_REQUEST) {
      if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
        this._requestsStarted++;
      }
      else if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
        this._requestsFinished++;
      }
      
      if (this._requestsStarted > 1) {
        var value = (100 * this._requestsFinished) / this._requestsStarted;
        var progress = document.getElementById("progress");
        progress.setAttribute("mode", "determined");
        progress.setAttribute("value", value);
      }
    }

    if (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK) {
      var progress = document.getElementById("progress");
      if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
        progress.hidden = false;
      }
      else if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
        progress.hidden = true;
        this.onStatusChange(aWebProgress, aRequest, 0, "Done");
        this._requestsStarted = this._requestsFinished = 0;
      }      
    }
    
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_DOCUMENT) {
      if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
        var domDocument = aWebProgress.DOMWindow.document;
        WebRunner.attachDocument(domDocument);
      }
    }
  },

  // This method is called to indicate progress changes for the currently
  // loading page.
  onProgressChange: function(aWebProgress, aRequest, aCurSelf, aMaxSelf, aCurTotal, aMaxTotal) {
    if (this._requestsStarted == 1) {
      var progress = document.getElementById("progress");
      if (aMaxSelf == -1) {
        progress.setAttribute("mode", "undetermined");
      }
      else {
        var value = ((100 * aCurSelf) / aMaxSelf);
        progress.setAttribute("mode", "determined");
        progress.setAttribute("value", value);
      }
    }
  },

  // This method is called to indicate a change to the current location.
  onLocationChange: function(aWebProgress, aRequest, aLocation) {
    document.getElementById("location").value = aLocation.spec;
  },

  // This method is called to indicate a status changes for the currently
  // loading page.  The message is already formatted for display.
  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
    var statusbar = document.getElementById("status");
    statusbar.setAttribute("label", aMessage);
  },

  // This method is called when the security state of the browser changes.
  onSecurityChange: function(aWebProgress, aRequest, aState) {
    var security = document.getElementById("security");

    var level = "unknown";
    switch (aState) {
      case Ci.nsIWebProgressListener.STATE_IS_SECURE | Ci.nsIWebProgressListener.STATE_SECURE_HIGH:
        security.setAttribute("level", "high");
        break;
      case Ci.nsIWebProgressListener.STATE_IS_SECURE | Ci.nsIWebProgressListener.STATE_SECURE_MEDIUM:
        security.setAttribute("level", "med");
        break;
      case Ci.nsIWebProgressListener.STATE_IS_SECURE | Ci.nsIWebProgressListener.STATE_SECURE_LOW:
        security.setAttribute("level", "low");
        break;
      case Ci.nsIWebProgressListener.STATE_IS_BROKEN:
        security.setAttribute("level", "broken");
        break;
      case Ci.nsIWebProgressListener.STATE_IS_INSECURE:
      default:
        security.removeAttribute("level");
        break;
    }
  }
};
