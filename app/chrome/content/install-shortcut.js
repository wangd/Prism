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
 *
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://app/modules/WebAppInstall.jsm");

var InstallShortcut = {
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
  },

  accept : function() {
    var name = document.getElementById("name");
    var locations = "";
    if (document.getElementById("desktop").checked)
      locations += "desktop,";
    if (document.getElementById("programs").checked)
      locations += "programs,";
    if (document.getElementById("quicklaunch").checked)
      locations += "quicklaunch,";

    var programs = document.getElementById("programs");
    if (window.arguments && name.value.length > 0 && locations.length > 0) {
      var wai = new WebAppInstall();
      if (window.arguments.length == 2) {
        var uri = document.getElementById("uri");
        var doLocation = document.getElementById("location").checked ? true : false;
        var doStatus = document.getElementById("status").checked ? true : false;
        var doNavigation = document.getElementById("navigation").checked ? true : false;
        var params = {id: name.value.toLowerCase() + "@prism.app", uri: uri.value, icon: "app", status: doStatus, location: doLocation, sidebar: "false", navigation: doNavigation};

        // Make the web application in the profile folder
        var wai = new WebAppInstall();
        wai.createApplication(params);
        wai.createShortcut(name.value, params.id, params.icon, locations);

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
      wai.createShortcut(name.value, window.arguments[0].id, window.arguments[0].icon, locations);
    }
    return true;
  }
};
