/*
# -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
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
# The Original Code is mozilla.org code.
#
# The Initial Developer of the Original Code is
# Mozilla.org.
# Portions created by the Initial Developer are Copyright (C) 1999
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
# Matthew Gertner <matthew.gertner@gmail.com>
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

/* Development of this Contribution was supported by Yahoo! Inc. */

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function AppStartup() {
}

AppStartup.prototype = {
  classDescription: "Application initialization",
  classID:          Components.ID("{54683c67-7e7c-444e-a9f7-bb47fe42d828}"),
  contractID:       "@mozilla.org/prism-app-startup;1",

  _xpcom_categories : [
    { category: "app-startup", service: true }
  ],

  QueryInterface: XPCOMUtils.generateQI(
    [Ci.nsIObserver,
     Ci.nsIClassInfo]),

  // nsIClassInfo
  implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
  flags: Ci.nsIClassInfo.DOM_OBJECT,

  getInterfaces: function getInterfaces(aCount) {
    var interfaces = [Ci.nsIObserver,
                      Ci.nsIClassInfo];
    aCount.value = interfaces.length;
    return interfaces;
  },

  getHelperForLanguage: function getHelperForLanguage(aLanguage) {
    return null;
  },

  //nsIObserver
  observe: function (aSubject, aTopic, aData) {
    switch (aTopic) {
    case "app-startup":
      var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      var resourceProtocol = ios.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
      
      var environment = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
      var rootPath = environment.get("PRISM_APP_BUNDLE");
      var resourcesRoot = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
      resourcesRoot.initWithPath(rootPath);
      
      resourceProtocol.setSubstitution("appbundle", ios.newFileURI(resourcesRoot));
      break;
    }
  },
}

var components = [AppStartup];

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule(components);
}
