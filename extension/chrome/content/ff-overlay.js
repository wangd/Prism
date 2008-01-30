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
 * The Initial Developer of the Original Code is Cesar Oliveira
 *	<a.sacred.line@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

function DownloadObserver(_oncomplete) {
	this.oncomplete = _oncomplete;
}

DownloadObserver.prototype = {
	QueryInterface : function(iid) {
		if (iid.equals(Ci.nsISupports) ||
		    iid.equals(Ci.nsIDownloadObserver)) {
			return this;
		}
		return Components.results.NS_NOINTERFACE;
	},

	onDownloadComplete  : function(downloader, request, ctxt, status , result) {
		this.oncomplete(downloader, request, ctxt, status , result);
	}
}

var PrismContentListener = {
	contentType : "application/x-prism",

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
		var observer = new DownloadObserver(function(downloader, request, ctxt, status, result) {
			prism.start_webapp(result.path);
		});
		var target = getTempFile("prism-tmp");

		downloader.init(observer, target);
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

function prism_onload() {
/*
	var uriloader = Cc["@mozilla.org/uriloader;1"].getService(Ci.nsIURILoader);

	uriloader.registerContentListener(PrismContentListener);
*/
}

function convertToApplication() {
  var fakeProfile = {
    script : {},
    id : "",
    fileTypes : [],
    uri : gBrowser.contentDocument.location.href,
    icon : "webrunner",
    status : false,
    location : false,
    sidebar : false,
    trayicon: false,
    credits : "",
    navigation : false,
    flags : ["id", "uri", "icon", "status", "location", "sidebar", "trayicon", "navigation", "credits"]
  };

  window.openDialog("chrome://refractor/content/install-shortcut.xul", "install", "centerscreen,modal", fakeProfile, { value: true});
}

window.addEventListener("load", prism_onload, false);
