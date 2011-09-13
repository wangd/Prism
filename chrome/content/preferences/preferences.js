/*
# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla Prism.
#
# The Initial Developer of the Original Code is
# Mark Finkle.
#
# Contributor(s):
# Matthew Gertner, <matthew.gertner@gmail.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****
*/

const Cc = Components.classes;
const Ci = Components.interfaces;

const builtinPanes = ["paneMain", "paneTabs", "paneContent", "paneApplications", "panePrivacy", "paneSecurity", "paneAdvanced"];

function PrefsOverlayObserver(aPrefsElement) {
  this._prefs = aPrefsElement;
}

PrefsOverlayObserver.prototype = {
  observe : function(aSubject, aTopic, aData) {
    // Add buttons for new panes
    var panes = document.getElementsByTagName("prefpane");
    for (var i=0; i<panes.length; i++) {
      var pane = panes.item(i);
      var builtin = false;
      for (var j=0; j<builtinPanes.length; j++) {
        if (builtinPanes[j] == pane.id) {
          builtin = true;
          break;
        }
      }
      
      if (!builtin) {
        this._prefs._makePaneButton(pane);
      }
    }
    
    // Remove buttons for deleted panes
    var button = this._prefs._selector.firstChild;
    while (button) {
      var next = button.nextSibling;
      if (!document.getElementById(button.getAttribute("pane"))) {
        this._prefs._selector.removeChild(button);
      }
      button = next;
    }

    // Show the current pane again since applying the overlay causes it to be displayed with no content
    var prefwindow = this._prefs;
    setTimeout(function() { prefwindow.showPane(prefwindow.currentPane); }, 0);
  }
}

var WebRunnerPrefs =
{
  init : function() {
    var prefwindow = document.getElementById("BrowserPreferences");
    var obs = new PrefsOverlayObserver(prefwindow);
    document.loadOverlay("resource://webapp/preferences/preferences.xul", obs);
  },
  
  paneLoad : function(e) {
    var paneElement = e.originalTarget;
    var paneSpec = paneElement.src;
    var parts = paneSpec.split('/');
    var filename = parts[parts.length-1];
    var overlaySpec = "resource://webapp/preferences/" + filename;

    function OverlayLoadObserver(aPrefsElement, aPaneElement, aContentHeight)
    {
      this._prefs = aPrefsElement;
      this._pane = aPaneElement;
      this._contentHeight = aContentHeight;
    }
    OverlayLoadObserver.prototype = { 
      observe: function (aSubject, aTopic, aData) 
      {
        if (this._prefs._shouldAnimate) {
          var dummyPane = document.createElement("prefpane");
          dummyPane.id = "paneDummy";
          dummyPane.contentHeight = this._contentHeight;
          document.documentElement.appendChild(dummyPane);
          this._prefs.lastSelected = "paneDummy";
          this._prefs._selectPane(this._pane);
          document.documentElement.removeChild(dummyPane);
        }
      }
    }
    
    var obs = new OverlayLoadObserver(document.getElementById("BrowserPreferences"), paneElement, paneElement.contentHeight);
    document.loadOverlay(overlaySpec, obs);
  }
};

window.addEventListener("paneload", WebRunnerPrefs.paneLoad, false);