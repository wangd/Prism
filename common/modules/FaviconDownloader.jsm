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
 * The Original Code is Mozilla.
 *
 * The Initial Developer of the Original Code is Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Matthew Gertner <matthew@allpeers.com>
 *   Mark Finkle <mark.finkle@gmail.com>, <mfinkle@mozilla.com>
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://prism/modules/ImageUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const PR_UINT32_MAX = 4294967295;

EXPORTED_SYMBOLS = ["FaviconDownloader"];

function FaviconDownloader() {
  this._storageStream = null;
  this._outputStream = null;
  this._mimeType = null;
  this._callback = null;
}

FaviconDownloader.prototype = {
  QueryInterface : function(iid)
  {
    if (iid,equals(Ci.nsISupports) || iid.equals(Ci.nsIStreamListener))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  set callback(callbackFunc) {
    this._callback = callbackFunc;
  },

  get mimeType() {
    return this._mimeType;
  },

  get imageStream()
  {
    if (this._storageStream)
      return this._storageStream.newInputStream(0);
    else
      return null;
  },

  handleEvent : function(event)
  {
    switch(event.type) {
      case "DOMLinkAdded":
        this.onLinkAdded(event);
        break;
      case "DOMContentLoaded":
        this.onContentLoaded(event);
        break;
    }
  },

  onLinkAdded : function(event)
  {
    var link = event.originalTarget;
    if (link.rel.toLowerCase() == "icon")
      this.loadIcon(link.type, event.originalTarget.baseURIObject.resolve(link.href));
  },

  onContentLoaded : function(event)
  {
    if (!this._mimeType)
    {
      // Didn't find a <link rel="icon"...> so try to guess where the favicon is
      this.loadIcon("image/vnd.microsoft.icon", event.originalTarget.baseURIObject.prePath + "/favicon.ico");
    }
  },

  loadIcon : function(mimeType, uriSpec)
  {
    this._mimeType = mimeType;
    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var channel = ioService.newChannel(uriSpec, "", null);
    channel.asyncOpen(this, null);
  },

  onStartRequest : function(request, context)
  {
    this._storageStream = ImageUtils.createStorageStream();
    this._outputStream = ImageUtils.getBufferedOutputStream(this._storageStream);
  },

  onStopRequest : function(request, context, statusCode)
  {
    // Need to check if we've been redirected to an error page
    if (statusCode == Components.results.NS_OK &&
        request.QueryInterface(Ci.nsIChannel).contentType != "text/html") {
      this._outputStream.flush();
    }

    if (this._callback)
      this._callback();
  },

  onDataAvailable : function(request, context, inputStream, offset, count)
  {
    this._outputStream.writeFrom(inputStream, count);
  }
};
