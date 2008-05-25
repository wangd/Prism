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
# Mark Finkle <mark.finkle@gmail.com>
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

const PRISM_PROTOCOL_PREFIX = "prism.protocol.";
const PROTOCOL_HANDLER_CLASSNAME = "WebRunner protocol handler";
const PROTOCOL_HANDLER_CID = Components.ID("{2033eb27-55cf-4e06-80ae-134b59ed5437}");

function PlatformGlueSound() {
  //Constructor
}

PlatformGlueSound.prototype = {
  classDescription: "Platform sound API",
  classID:          Components.ID("{eb7e36e0-ec6d-11dc-95ff-0800200c9a66}"),
  contractID:       "@mozilla.org/platform-sound-api;1",

  QueryInterface: XPCOMUtils.generateQI(
    [Ci.nsIPlatformGlueSound,
     Ci.nsISecurityCheckedComponent,
     Ci.nsIClassInfo]),

  // nsIClassInfo
  implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
  flags: Ci.nsIClassInfo.DOM_OBJECT,

  getInterfaces: function getInterfaces(aCount) {
    var interfaces = [Ci.nsIPlatformGlueSound,
                      Ci.nsISecurityCheckedComponent,
                      Ci.nsIClassInfo];
    aCount.value = interfaces.length;
    return interfaces;
  },

  getHelperForLanguage: function getHelperForLanguage(aLanguage) {
    return null;
  },

  //nsISecurityCheckedComponent
  canCallMethod: function canCallMethod(iid, methodName) {
    Components.utils.reportError(methodName);
    return "AllAccess";
  },

  canCreateWrapper: function canCreateWrapper(iid) {
    return "AllAccess";
  },

  canGetProperty: function canGetProperty(iid, propertyName) {
    Components.utils.reportError(propertyName);
    return "AllAccess";
  },

  canSetProperty: function canSetProperty(iid, propertyName) {
    Components.utils.reportError(propertyName);
    return "NoAccess";
  },

  //nsIPlatformGlueSound
  beep: function beep() {
    var sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
    sound.beep();
  },

  playSound: function playSound(aSoundURI) {
    var sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
    if (aSound.indexOf("://") == -1) {
      sound.playSystemSound(aSoundURI);
    }
    else
    {
      var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      sound.play(ioService.newURI(aSoundURI, null, null));
    }
  }
}

function MakeProtocolHandlerFactory(contractid) {
  var factory = {
    QueryInterface: function (aIID) {
      if (!aIID.equals(Components.interfaces.nsISupports) &&
        !aIID.equals(Components.interfaces.nsIFactory))
        throw Components.results.NS_ERROR_NO_INTERFACE;
      return this;
    },
    createInstance: function (outer, iid) {
      if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      return (new PlatformProtocolHandler(contractid)).QueryInterface(iid);
    }
  };

  return factory;
}

function PlatformProtocolHandler(contractid) {
  this._ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
}

PlatformProtocolHandler.prototype = {
  QueryInterface: XPCOMUtils.generateQI(
    [Ci.nsIProtocolHandler,
    Ci.nsIClassInfo]),

  // nsIClassInfo
  implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
  flags: Ci.nsIClassInfo.DOM_OBJECT,

  getInterfaces: function getInterfaces(aCount) {
    var interfaces = [Ci.nsIProtocolHandler,
                      Ci.nsIClassInfo];
    aCount.value = interfaces.length;
    return interfaces;
  },

  getHelperForLanguage: function getHelperForLanguage(aLanguage) {
    return null;
  },

  get defaultPort() {
    return 80;
  },

  get protocolFlags() {
    return 0;
  },

  newURI: function newURI(aSpec, anOriginalCharset, aBaseURI) {
    var platformGlue = Cc["@mozilla.org/platform-web-api;1"].createInstance(Ci.nsIPlatformGlue);
    var uriString = platformGlue.getProtocolURI(aSpec);
    return this._ioService.newURI(uriString, "", null);
  },
  
  newChannel: function newChannel(aUri) {
    var uri = this.newURI(aUri.spec, "", null);
    return this._ioService.newChannelFromURI(uri, null);
  },
  
  allowPort: function allowPort(aPort, aScheme) {
    // We are not overriding any special ports
    return false;
  }
}

//=================================================
// Factory - Treat PlatformGlue as a singleton
// XXX This is required, because we're registered for the 'JavaScript global
// privileged property' category, whose handler always calls createInstance.
// See bug 386535.
var gSingleton = null;
var PlatformGlueFactory = {
  createInstance: function af_ci(aOuter, aIID) {
    if (aOuter != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    if (gSingleton == null) {
      gSingleton = new PlatformGlue();
    }

    return gSingleton.QueryInterface(aIID);
  }
};

function PlatformGlue() {
  // WebProgressListener for getting notification of new doc loads.
  var progress = Cc["@mozilla.org/docloaderservice;1"].getService(Ci.nsIWebProgress);
  progress.addProgressListener(this, Ci.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
}

PlatformGlue.prototype = {
  classDescription: "Platform web API",
  classID:          Components.ID("{3960e4b8-89d1-4c20-ae24-4d10d0900c4d}"),
  contractID:       "@mozilla.org/platform-web-api;1",

  _xpcom_factory : PlatformGlueFactory,

  _xpcom_categories : [{
    category: "JavaScript global property",
    entry: "platform"
  }],

  _prefs : Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch),
  _window : null,
  _icon : null,

  QueryInterface: XPCOMUtils.generateQI(
    [Ci.nsIPlatformGlue,
     Ci.nsISecurityCheckedComponent,
     Ci.nsISupportsWeakReference,
     Ci.nsIWebProgressListener,
     Ci.nsIClassInfo]),

  // nsIClassInfo
  implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
  flags: Ci.nsIClassInfo.DOM_OBJECT,

  getInterfaces: function getInterfaces(aCount) {
    var interfaces = [Ci.nsIPlatformGlue,
                      Ci.nsISecurityCheckedComponent,
                      Ci.nsISupportsWeakReference,
                      Ci.nsIWebProgressListener,
                      Ci.nsIClassInfo];
    aCount.value = interfaces.length;
    return interfaces;
  },

  getHelperForLanguage: function getHelperForLanguage(aLanguage) {
    return null;
  },

  //nsISecurityCheckedComponent
  canCallMethod: function canCallMethod(iid, methodName) {
    Components.utils.reportError(methodName);
    return "AllAccess";
  },

  canCreateWrapper: function canCreateWrapper(iid) {
    return "AllAccess";
  },

  canGetProperty: function canGetProperty(iid, propertyName) {
    Components.utils.reportError(propertyName);
    return "AllAccess";
  },

  canSetProperty: function canSetProperty(iid, propertyName) {
    Components.utils.reportError(propertyName);
    return "NoAccess";
  },

  // nsIWebProgressListener
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_TRANSFERRING) {
      this._window = aWebProgress.DOMWindow;
    }
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelf, aMaxSelf, aCurTotal, aMaxTotal) {
  },

  onLocationChange: function(aWebProgress, aRequest, aLocation) {
  },

  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
  },

  onSecurityChange: function(aWebProgress, aRequest, aState) {
  },
  
  //nsIPlatformGlue
  showNotification: function showNotification(aTitle, aText, aImageURI) {
    var alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
    alerts.showAlertNotification(aImageURI, aTitle, aText, false, "", null);
  },

  postStatus: function postStatus(aName, aValue) {
    if (this._icon)
      this._icon.setBadgeText(aValue);
  },

  sound: function sound() {
    if (!this._sound)
      this._sound = new PlatformGlueSound();
    return this._sound;
  },

  icon: function icon() {
    if (!this._window) {
      // Not initialized yet
      throw Components.results.NS_ERROR_NOT_INITIALIZED;
    }
    
    if (!this._icon) {
      var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
      this._icon = desktop.getApplicationIcon(this._window);
    }
    return this._icon;
  },
  
  registerProtocolHandler: function registerProtocol(uriScheme, uriString) {
    // First register the protocol with the shell
    var shellService = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIShellService);
    shellService.registerProtocol(uriScheme, null, null);
    
    // Register with the component registrar
    var registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    var contractId = "@mozilla.org/network/protocol;1?name=" + uriScheme;
    registrar.registerFactory(PROTOCOL_HANDLER_CID, PROTOCOL_HANDLER_CLASSNAME, contractId,
      MakeProtocolHandlerFactory(contractId));
    
    // Then store a pref so we remember the URI string we want to load
    this._prefs.setCharPref(PRISM_PROTOCOL_PREFIX + uriScheme, uriString);
  },
  
  unregisterProtocolHandler: function unregisterProtocol(uriScheme) {
    // Unregister the protocol with the shell so the URI scheme no longer invokes the application
    var shellService = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIShellService);
    shellService.unregisterProtocol(uriScheme);
    
    // Unregister with the component registrar
    var registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    var contractId = "@mozilla.org/network/protocol;1?name=" + uriScheme;
    // Now what?

    // And remove the pref
    this._prefs.clearUserPref(PRISM_PROTOCOL_PREFIX + uriScheme);
  },
  
  getProtocolURI : function getProtocolCallback(uriSpec) {
    try {
      var uriString = this._prefs.getCharPref(PRISM_PROTOCOL_PREFIX + uriSpec.replace(/(.*):.*/, "$1"));
      return uriString.replace(/%s/, uriSpec.replace(/.*:(.*)/, "$1"));
    }
    catch (e) {
      return "";
    }
  }
}

var components = [PlatformGlue];

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule(components);
}
