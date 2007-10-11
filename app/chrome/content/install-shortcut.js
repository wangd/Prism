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
    if (window.arguments.length == 2 && name.value.length > 0 && locations.length > 0) {
      var wai = new WebAppInstall();
      wai.createShortcut(name.value, window.arguments[0], window.arguments[1], locations);
    }
    return true;
  }
};
