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

Components.utils.import("resource://app/modules/ImageUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const PR_UINT32_MAX = 4294967295;

EXPORTED_SYMBOLS = ["FaviconDownloader"];

var FaviconDownloader = {
  _storageStream : null,
  _outputSteam : null,
  _mimeType : null,
  _generatedImageStream : null,
  _callback : null,

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

  getGeneratedImage : function()
  {
    if (!this._generatedImageStream)
      return null;
    return this._generatedImageStream.newInputStream(0);
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
    this._storageStream = this.createStorageStream();
    this._outputStream = this.getBufferedOutputStreamForStorageStream(this._storageStream);
  },

  onStopRequest : function(request, context, statusCode)
  {
    if (statusCode != Components.results.NS_OK)
      return;

    this._outputStream.flush();
    var inputStream = this._storageStream.newInputStream(0);
    this._generatedImageStream = this.createStorageStream();
    ImageUtils.createNativeIcon(inputStream, this._mimeType,
      this.getBufferedOutputStreamForStorageStream(
      this._generatedImageStream));
    this._storageStream.close();

    if (this._callback)
      this._callback();
  },

  onDataAvailable : function(request, context, inputStream, offset, count)
  {
    this._outputStream.writeFrom(inputStream, count);
  },

  createStorageStream : function()
  {
    var storageStream = Cc["@mozilla.org/storagestream;1"].createInstance(Ci.nsIStorageStream);
    storageStream.init(4096, PR_UINT32_MAX, null);
    return storageStream;
  },

  getBufferedOutputStreamForStorageStream : function(storageStream)
  {
    var outputStream = storageStream.getOutputStream(0);
    var bufferedStream = Cc["@mozilla.org/network/buffered-output-stream;1"].
                         createInstance(Ci.nsIBufferedOutputStream);
    bufferedStream.init(outputStream, 1024);
    return bufferedStream;
  }
};
