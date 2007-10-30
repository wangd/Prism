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


function FileListener(target) {
	this.file = target;
}

FileListener.prototype = {
	QueryInterface: function(iid) {
		if (iid.equals(Components.interfaces.nsIWebProgressListener) ||
		    iid.equals(Components.interfaces.nsISupports))
			return this;
		throw Components.results.NS_NOINTERFACE;
	},

	onLocationChange : function(webProgress, request, location) { },

	onProgressChange : function(webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) { },

	onSecurityChange : function(webProgress, request, state) { },

	onStateChange : function(webProgress, request, stateFlags, status) {
		if (stateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
			Prism.start_webapp(this.file.path);
		}
	},

	onStatusChange : function(webProgress, request, status, message) { }
}

/* @TODO Let the DownloadManager in on this */
function download(target) {
		var browser = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
		var url = Cc["@mozilla.org/network/standard-url;1"].createInstance(Ci.nsIStandardURL);
		var temp = File.getTemporary("prism-tmp");

		url.init(Ci.nsIStandardURL.URLTYPE_STANDARD, 80, target, null, null);

		browser.progressListener = new FileListener(temp);
		browser.saveURI(url, null, null, null, null, temp);
}

function wp_onload() {
	document.addEventListener("popupshowing", function() {
		if (!document.popupNode)
			return;

		var element = document.popupNode;
		var menuitem = document.getElementById("prism-menuitem");
		var regex = new RegExp("\.webapp$");

		if (element.href && regex.test(element.href) == true) {
			menuitem.hidden = false;
		} else {
			menuitem.hidden = true;
		}
	}, false);
}

window.addEventListener("load", wp_onload, false);

