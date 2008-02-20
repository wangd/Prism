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

Components.utils.import("resource://gre/modules/JSON.jsm");
Components.utils.import("resource://app/modules/WebAppInstall.jsm");

window.addEventListener("load", function() { WebRunner.startup(); }, false);
window.addEventListener("unload", function() { WebRunner.shutdown(); }, false);

/**
 * Simple host API exposed to the web application script files.
 */
var HostUI = {
  log : function(aMsg) {
    var console = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
    console.logStringMessage(aMsg);
  },

  getBrowser : function() {
    return document.getElementById("browser_content");
  },

  showAlert : function(aImage, aTitle, aMsg) {
    var alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
    alerts.showAlertNotification(aImage, aTitle, aMsg, false, "", null);
  },

  getResource : function(aResource) {
    var resourceSpec = "chrome://webrunner/skin/resources/" + aResource;
    return resourceSpec;
  },

  playSound : function(aSound) {
    var sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
    if (aSound == "beep") {
      sound.beep();
    }
    else if (aSound.indexOf("://") == -1) {
      sound.playSystemSound(aSound);
    }
    else
    {
      var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      sound.play(ioService.newURI(aSound, null, null));
    }
  },

  getAttention : function() {
    window.getAttention();
  },

  sidebar : {
    get visible() {
      return document.getElementById("splitter_sidebar").getAttribute("state") == "open";
    },

    set visible(show) {
      document.getElementById("splitter_sidebar").setAttribute("state", show ? "open" : "collapsed");
    },

    add : function(title, uri) {
      document.getElementById("box_sidebar").href = uri;
      document.getElementById("label_sidebar").value = title;
      document.getElementById("browser_sidebar").setAttribute("src", uri);
    }
  }
};

/**
 * Main application code.
 */
var WebRunner = {
  _ios : null,
  _tld : null,

  _getBrowser : function() {
    return document.getElementById("browser_content");
  },

  _saveSettings : function() {
      var settings = {};
      settings.version = "1";

      // Pull out the window state
      settings.window = {};
      settings.window.state = window.windowState;
      if (window.windowState == window.STATE_NORMAL) {
        settings.window.screenX = window.screenX;
        settings.window.screenY = window.screenY;
        settings.window.width = window.outerWidth;
        settings.window.height = window.outerHeight;
      }

      settings.sidebar = {};
      settings.sidebar.visible = (document.getElementById("splitter_sidebar").getAttribute("state") == "open");
      settings.sidebar.width = document.getElementById("box_sidebar").width;

      // Save using JSON format
      if (WebAppProperties.hasOwnProperty("id")) {
        var json = JSON.toString(settings);
        var file = WebAppInstall.getInstallRoot();
        file.append(WebAppProperties.id);
        file.append("localstore.json");
        FileIO.stringToFile(json, file);
      }
  },

  _loadSettings : function() {
      // Load using JSON format
      var settings;
      if (WebAppProperties.hasOwnProperty("id")) {
        var file = WebAppInstall.getInstallRoot();
        file.append(WebAppProperties.id);
        file.append("localstore.json");
        if (file.exists()) {
          var json = FileIO.fileToString(file);
          settings = JSON.fromString(json);

          if (settings.window) {
            switch (settings.window.state) {
              case window.STATE_MAXIMIZED:
                window.maximize();
                break;
              case window.STATE_MINIMIZED:
                // Do nothing if window was closed minimized
                break;
              case window.STATE_NORMAL:
                window.moveTo(settings.window.screenX, settings.window.screenY);
                window.resizeTo(settings.window.width, settings.window.height);
                break;
            }
          }

          if (settings.sidebar) {
            document.getElementById("splitter_sidebar").setAttribute("state", settings.sidebar.visible ? "open" : "collapsed");
            document.getElementById("box_sidebar").width = settings.sidebar.width;
          }
        }
      }
  },

  _delayedStartup : function() {
    this._loadSettings();

    WebAppProperties.script["host"] = HostUI;
    if (WebAppProperties.script.startup)
      WebAppProperties.script.startup();
  },

  _processConfig : function() {
    // Process commandline parameters
    document.documentElement.setAttribute("id", WebAppProperties.icon);
    document.getElementById("locationbar").hidden = !WebAppProperties.location;
    document.getElementById("box_sidebar").hidden = !WebAppProperties.sidebar;
    document.getElementById("splitter_sidebar").hidden = !WebAppProperties.sidebar;

    if (!WebAppProperties.navigation) {
      // Remove navigation key from the document
      var keys = document.getElementsByTagName("key");
      for (var i=keys.length - 1; i>=0; i--)
        if (keys[i].className == "nav")
          keys[i].parentNode.removeChild(keys[i]);
    }

    document.title = WebAppProperties.name;

    if (WebAppProperties.trayicon) {
      var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
      desktop.QueryInterface(Ci.nsINotificationArea).setTitle(WebAppProperties.id, document.title);
    }

    if (WebAppProperties.uri)
        this._getBrowser().loadURI(WebAppProperties.uri, null, null);
  },

  _handleWindowClose : function(event) {
    // Handler for clicking on the 'x' to close the window
    return this.shutdownQuery();
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

    var copylink = document.getElementById("menuitem_copylink");
    var copylinkSep = document.getElementById("menusep_copylink");
    if (target instanceof HTMLAnchorElement && target.href) {
      copylink.hidden = false;
      copylinkSep.hidden = false;
    }
    else {
      copylink.hidden = true;
      copylinkSep.hidden = true;
    }

    InlineSpellCheckerUI.clearSuggestionsFromMenu();
    InlineSpellCheckerUI.uninit();

    var separator = document.getElementById("menusep_spellcheck");
    separator.hidden = true;
    var addToDictionary = document.getElementById("menuitem_addToDictionary");
    addToDictionary.hidden = true;
    var noSuggestions = document.getElementById("menuitem_noSuggestions");
    noSuggestions.hidden = true;

    // if the document is editable, show context menu like in text inputs
    var win = target.ownerDocument.defaultView;
    if (win) {
      var isEditable = false;
      try {
        var editingSession = win.QueryInterface(Ci.nsIInterfaceRequestor)
                                .getInterface(Ci.nsIWebNavigation)
                                .QueryInterface(Ci.nsIInterfaceRequestor)
                                .getInterface(Ci.nsIEditingSession);
        isEditable = editingSession.windowIsEditable(win);
      }
      catch(ex) {
        // If someone built with composer disabled, we can't get an editing session.
      }
    }

    var editor = null;
    if (isTextField && !target.readOnly)
      editor = target.QueryInterface(Ci.nsIDOMNSEditableElement).editor;

    if (isEditable)
      editor = editingSession.getEditorForWindow(win);

    if (editor) {
      InlineSpellCheckerUI.init(editor);
      InlineSpellCheckerUI.initFromEvent(document.popupRangeParent, document.popupRangeOffset);

      var onMisspelling = InlineSpellCheckerUI.overMisspelling;
      if (onMisspelling) {
        separator.hidden = false;
        addToDictionary.hidden = false;
        var menu = document.getElementById("popup_content");
        var suggestions = InlineSpellCheckerUI.addSuggestionsToMenu(menu, addToDictionary, 5);
        noSuggestions.hidden = (suggestions > 0);
      }
    }
  },

  _tooltipShowing : function(aEvent) {
    var tooltipNode = document.tooltipNode;
    var canShow = false;
    if (tooltipNode.namespaceURI != "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul") {
      const XLinkNS = "http://www.w3.org/1999/xlink";

      var titleText = null;
      var XLinkTitleText = null;
      var direction = tooltipNode.ownerDocument.dir;
      var defView = tooltipNode.ownerDocument.defaultView;

      while (defView && !titleText && !XLinkTitleText && tooltipNode) {
        if (tooltipNode.nodeType == Node.ELEMENT_NODE) {
          titleText = tooltipNode.getAttribute("title");
          XLinkTitleText = tooltipNode.getAttributeNS(XLinkNS, "title");
          direction = defView.getComputedStyle(tooltipNode, "").getPropertyValue("direction");
        }
        tooltipNode = tooltipNode.parentNode;
      }

      var tooltip = document.getElementById("tooltip_content");
      tooltip.style.direction = direction;

      for each (var text in [titleText, XLinkTitleText]) {
        if (text && /\S/.test(text)) {
          // Per HTML 4.01 6.2 (CDATA section), literal CRs and tabs should be
          // replaced with spaces, and LFs should be removed entirely.
          text = text.replace(/[\r\t]/g, ' ');
          text = text.replace(/\n/g, '');

          tooltip.setAttribute("label", text);
          canShow = true;
        }
      }
    }

    if (!canShow)
      aEvent.preventDefault();
  },

  _isLinkExternal : function(aLink) {
    var isExternal = true;
    if (aLink instanceof HTMLAnchorElement) {
      if (aLink.target == "_self" || aLink.target == "_top") {
        isExternal = false;
      }
      else {
        var linkDomain = this._tld.getBaseDomain(this._ios.newURI(aLink.href, null, null).QueryInterface(Ci.nsIURL));
        var currentDomain = this._tld.getBaseDomain(this._getBrowser().currentURI);
        if (linkDomain == currentDomain)
          isExternal = false;
      }
    }
    return isExternal;
  },

  _dragOver : function(aEvent)
  {
    var dragService = Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService);
    var dragSession = dragService.getCurrentSession();

    var supported = dragSession.isDataFlavorSupported("text/x-moz-url");
    if (!supported)
      supported = dragSession.isDataFlavorSupported("application/x-moz-file");

    if (supported)
      dragSession.canDrop = true;
  },

  _dragDrop : function(aEvent)
  {
    var dragService = Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService);
    var dragSession = dragService.getCurrentSession();
    if (dragSession.sourceNode)
      return;

    var trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
    trans.addDataFlavor("text/x-moz-url");
    trans.addDataFlavor("application/x-moz-file");

    var uris = [];
    for (var i=0; i<dragSession.numDropItems; i++) {
      var uri = null;

      dragSession.getData(trans, i);
      var flavor = {}, data = {}, length = {};
      trans.getAnyTransferData(flavor, data, length);
      if (data) {
        try {
          var str = data.value.QueryInterface(Ci.nsISupportsString);
        }
        catch(ex) {
        }

        if (str) {
          uri = this._ios.newURI(str.data.split("\n")[0], null, null);
        }
        else {
          var file = dataObj.value.QueryInterface(Ci.nsIFile);
          if (file)
            uri = this._ios.newFileURI(file);
        }
      }

      if (uri)
        uris.push(uri);
    }

    if (WebAppProperties.script.dropFiles)
      WebAppProperties.script.dropFiles(uris);
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

  startup : function()
  {
    this._ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    this._tld = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);

    var install = false;

    if (window.arguments && window.arguments[0]) {
      this.handleCommandLine(window.arguments[0].QueryInterface(Ci.nsICommandLine));

      install = window.arguments[0].handleFlag("install-webapp", false);
      if (!install)
        install = (WebAppProperties.uri == null || WebAppProperties.name == null);

      // Set the windowtype attribute here, so we always know which window is the main window
      document.documentElement.setAttribute("windowtype", "webrunner:main");

      // Hack to get the mime handler initialized correctly so the content handler dialog doesn't appear
      var hs = Cc["@mozilla.org/uriloader/handler-service;1"].getService(Ci.nsIHandlerService);
      var extps = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);

      // Set the 'http' handler
      var httpHandler = extps.getProtocolHandlerInfo("http");
      httpHandler.preferredAction = Ci.nsIHandlerInfo.useSystemDefault;
      httpHandler.alwaysAskBeforeHandling = false;
      hs.store(httpHandler);

      // Set the 'https' handler
      var httpsHandler = extps.getProtocolHandlerInfo("https");
      httpsHandler.preferredAction = Ci.nsIHandlerInfo.useSystemDefault;
      httpsHandler.alwaysAskBeforeHandling = false;
      hs.store(httpsHandler);
    }

    var self = this;

    // Do we need to handle making a web application?
    if (install) {
      function _showInstall() {
        var cancel = {value: true};
        window.openDialog("chrome://webrunner/content/install-shortcut.xul", "install", "centerscreen,modal", WebAppProperties, cancel);

        // Since we needed to install and the user must have canceled, lets close webrunner
        if (cancel.value) {
          window.close();
        }
        else {
          WebAppInstall.restart(WebAppProperties.id);
          window.close();
          //self._processConfig();
        }
      }

      setTimeout(_showInstall, 250);
    }

    // Hookup the browser window callbacks
    window.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIWebNavigation)
          .QueryInterface(Ci.nsIDocShellTreeItem)
          .treeOwner
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIXULWindow)
          .XULBrowserWindow = this;

    window.addEventListener("close", function(event) { self._handleWindowClose(event); }, false);

    var browser = this._getBrowser();
    browser.addEventListener("dragover", function(aEvent) { self._dragOver(aEvent); }, true)
    browser.addEventListener("dragdrop", function(aEvent) { self._dragDrop(aEvent); }, true)
    browser.webProgress.addProgressListener(this, Ci.nsIWebProgress.NOTIFY_ALL);

    this._processConfig();

    document.getElementById("popup_content").addEventListener("popupshowing", self._popupShowing, false);
    document.getElementById("tooltip_content").addEventListener("popupshowing", self._tooltipShowing, false);

    // Let osx make its app menu, then hide the window menu
    var mainMenu = document.getElementById("menu_main");
    if (mainMenu) {
      mainMenu.hidden = true;

      // Needed for linux or the menubar doesn't hide
      document.getElementById("menu_file").hidden = true;
    }

    if (WebAppProperties.trayicon)
      this.showTrayIcon();

    setTimeout(function() { self._delayedStartup(); }, 0);
  },

  handleCommandLine : function(aCmdLine) {
    if (!aCmdLine)
      return;

    var file = null;

    // Check for a webapp profile
    var webapp = aCmdLine.handleFlagWithParam("webapp", false);
    if (webapp) {
      // Check for a bundle first
      try {
        file = aCmdLine.resolveFile(webapp);
      }
      catch (ex) {
        // Ouch, not a file
        file = null;
      }

      // Do we have a valid file? or did it fail?
      if (!file || !file.exists()) {
        // Its not a bundle. look for an installed webapp
        var appSandbox = WebAppInstall.getInstallRoot();
        appSandbox.append(webapp);
        if (appSandbox.exists())
          file = appSandbox.clone();
      }
    }

    // Check for an OSX launch
    if (!file) {
      var uri = aCmdLine.handleFlagWithParam("url", false);
      if (uri) {
        uri = aCmdLine.resolveURI(uri);
        file = uri.QueryInterface(Ci.nsIFileURL).file;
      }
    }

    if (file && file.exists()) {
      // Bundles are files and need to be installed
      if (!file.isDirectory())
        file = WebAppInstall.install(file);

      WebAppInstall.init(file);
    }

    WebAppInstall.readCommandLine(aCmdLine);
  },

  showTrayIcon : function() {
    var appIcon = WebAppInstall.getInstallRoot();
    appIcon.append(WebAppProperties.id);
    appIcon.append("icons");
    appIcon.append("default");
    appIcon.append(WebAppProperties.icon + ".ico");

    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var iconUri = ioService.newFileURI(appIcon);

    var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
    var notificationArea = desktop.QueryInterface(Ci.nsINotificationArea);
    notificationArea.showIcon(WebAppProperties.id, iconUri, this);
    notificationArea.setTitle(WebAppProperties.id, document.title);
  },

  shutdownQuery : function() {
    this._saveSettings();

    return true;
  },

  shutdown : function()
  {
    if (WebAppProperties.trayicon) {
      var desktop = Cc["@mozilla.org/desktop-environment;1"].
        getService(Ci.nsIDesktopEnvironment);
      desktop.QueryInterface(Ci.nsINotificationArea).hideIcon(WebAppProperties.id);
    }

    if (WebAppProperties.script.shutdown)
      WebAppProperties.script.shutdown();
  },

  doCommand : function(aCmd) {
    switch (aCmd) {
      case "cmd_cut":
      case "cmd_copy":
      case "cmd_paste":
      case "cmd_delete":
      case "cmd_selectAll":
        goDoCommand(aCmd);
        break;
      case "cmd_copylink":
        var target = document.popupNode;
        if (target instanceof HTMLAnchorElement && target.href) {
          var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper);
          clipboard.copyString(target.href);
        }
        break;
      case "cmd_print":
        PrintUtils.print();
        break;
      case "cmd_pageSetup":
        PrintUtils.showPageSetup();
        break;
      case "cmd_about":
        window.openDialog("chrome://webrunner/content/about.xul", "about", "centerscreen,modal", WebAppProperties);
        break;
      case "cmd_back":
        this._getBrowser().goBack();
        break;
      case "cmd_forward":
        this._getBrowser().goForward();
        break;
      case "cmd_home":
        this._getBrowser().loadURI(WebAppProperties.uri, null, null);
        break;
      case "cmd_reload":
        this._getBrowser().reload();
        break;
      case "cmd_close":
        if (this.shutdownQuery())
          close();
        break;
      case "cmd_quit":
        if (this.shutdownQuery())
          goQuitApplication();
        break;
      case "cmd_console":
        window.open("chrome://global/content/console.xul", "_blank", "chrome,extrachrome,dependent,menubar,resizable,scrollbars,status,toolbar");
        break;
      case "cmd_install":
        window.openDialog("chrome://webrunner/content/install-shortcut.xul", "install", "centerscreen,modal", WebAppProperties);
        break;
      case "cmd_addons":
        const EMTYPE = "Extension:Manager";

        var aOpenMode = "extensions";
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Components.interfaces.nsIWindowMediator);
        var needToOpen = true;
        var windowType = EMTYPE + "-" + aOpenMode;
        var windows = wm.getEnumerator(windowType);
        while (windows.hasMoreElements()) {
          var theEM = windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindowInternal);
          if (theEM.document.documentElement.getAttribute("windowtype") == windowType) {
            theEM.focus();
            needToOpen = false;
            break;
          }
        }

        if (needToOpen) {
          const EMURL = "chrome://mozapps/content/extensions/extensions.xul?type=" + aOpenMode;
          const EMFEATURES = "chrome,dialog=no,resizable=yes";
          window.openDialog(EMURL, "", EMFEATURES);
        }
        break;
    }
  },

  attachDocument : function(aDocument) {
    var self = this;
    aDocument.addEventListener("click", function(aEvent) { self._domClick(aEvent); }, true);
    aDocument.addEventListener("DOMActivate", function(aEvent) { self._domActivate(aEvent); }, true);
  },

  // nsIXULBrowserWindow implementation to display link destinations in the statusbar
  setJSStatus: function() { },
  setJSDefaultStatus: function() { },
  setOverLink: function(aStatusText, aLink) {
    var statusbar = document.getElementById("status");
    statusbar.label = aStatusText;
  },

  // nsIWebProgressListener implementation to monitor activity in the browser.
  _requestsStarted: 0,
  _requestsFinished: 0,

  // This method is called to indicate state changes.
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_REQUEST) {
      if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
        this._requestsStarted++;
      }
      else if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
        this._requestsFinished++;
      }

      if (WebAppProperties.status && this._requestsStarted > 1) {
        var value = (100 * this._requestsFinished) / this._requestsStarted;
        var progress = document.getElementById("progress");
        progress.setAttribute("mode", "determined");
        progress.setAttribute("value", value);
      }
    }

    if (WebAppProperties.status && (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK)) {
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
        this.attachDocument(domDocument);
      }
    }
  },

  // This method is called to indicate progress changes for the currently
  // loading page.
  onProgressChange: function(aWebProgress, aRequest, aCurSelf, aMaxSelf, aCurTotal, aMaxTotal) {
    if (WebAppProperties.status && this._requestsStarted == 1) {
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
    if (WebAppProperties.status) {
      var statusbar = document.getElementById("status");
      statusbar.setAttribute("label", aMessage);
    }
  },

  // This method is called when the security state of the browser changes.
  onSecurityChange: function(aWebProgress, aRequest, aState) {
    var security = document.getElementById("security");
    var browser = this._getBrowser();

    security.removeAttribute("label");
    switch (aState) {
      case Ci.nsIWebProgressListener.STATE_IS_SECURE | Ci.nsIWebProgressListener.STATE_SECURE_HIGH:
        security.setAttribute("level", "high");
        security.setAttribute("label", browser.contentWindow.location.host);
        break;
      case Ci.nsIWebProgressListener.STATE_IS_SECURE | Ci.nsIWebProgressListener.STATE_SECURE_MEDIUM:
        security.setAttribute("level", "med");
        security.setAttribute("label", browser.contentWindow.location.host);
        break;
      case Ci.nsIWebProgressListener.STATE_IS_SECURE | Ci.nsIWebProgressListener.STATE_SECURE_LOW:
        security.setAttribute("level", "low");
        security.setAttribute("label", browser.contentWindow.location.host);
        break;
      case Ci.nsIWebProgressListener.STATE_IS_BROKEN:
        security.setAttribute("level", "broken");
        break;
      case Ci.nsIWebProgressListener.STATE_IS_INSECURE:
      default:
        security.removeAttribute("level");
        break;
    }
  },

  onNotificationAreaClick : function(button, clickCount) {
    if (button == 0 && clickCount == 2) {
      var desktopEnv = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
      desktopEnv.setZLevel(window, Ci.nsIDesktopEnvironment.zLevelTop);
    }
  },

  // We need to advertize that we support weak references.  This is done simply
  // by saying that we QI to nsISupportsWeakReference.  XPConnect will take
  // care of actually implementing that interface on our behalf.
  QueryInterface: function(aIID) {
    if (aIID.equals(Ci.nsIWebProgressListener) ||
        aIID.equals(Ci.nsISupportsWeakReference) ||
        aIID.Equals(Ci.nsIXULBrowserWindow) ||
        aIID.Equals(Ci.nsINotificationAreaListener) ||
        aIID.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};
