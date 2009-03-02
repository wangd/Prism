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
 *   Matthew Gertner <matthew.gertner@gmail.com>
 *
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;

EXPORTED_SYMBOLS = ["HostUI"];

/**
 * Simple host API exposed to the web application script files.
 */
var HostUI = {
  _document : null,
  _window :   null,

  log : function(aMsg) {
    var console = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
    console.logStringMessage(aMsg);
  },

  getBrowser : function() {
    return this._document.getElementById("browser_content");
  },
  
  showAbout : function() {
    this._window.openDialog("chrome://webrunner/content/about.xul", "about", "centerscreen,modal");
  },
  
  showPreferences : function(paneToShow) {
    this._window.openDialog("chrome://webrunner/content/preferences/preferences.xul", "preferences", "chrome,titlebar,toolbar,centerscreen,dialog=no", paneToShow);
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
      return this._document.getElementById("splitter_sidebar").getAttribute("state") == "open";
    },

    set visible(show) {
      this._document.getElementById("splitter_sidebar").setAttribute("state", show ? "open" : "collapsed");
    },

    add : function(title, uri) {
      this._document.getElementById("box_sidebar").href = uri;
      this._document.getElementById("label_sidebar").value = title;
      this._document.getElementById("browser_sidebar").setAttribute("src", uri);
    }
  }
};
