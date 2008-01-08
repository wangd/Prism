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
 *
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;
const PR_UINT32_MAX = 4294967295;

Components.utils.import("resource://app/modules/ImageUtils.jsm");

EXPORTED_SYMBOLS = ["FaviconDownloader"];

var FaviconDownloader = {
  _storageStream : null,
  _outputSteam : null,
  _uri : null,
  _mimeType : null,
  _targetDir : null,
  
  QueryInterface : function(iid)
  {
    if (iid,equals(Ci.nsISupports) || iid.equals(Ci.nsIStreamListener))
      return this;
      
    throw Components.results.NS_ERROR_NO_INTERFACE;
  },
  
  init : function(uri, targetDir)
  {
    this._uri = uri;
    this._targetDir = targetDir;
    this._mimeType = null;
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
      this.loadIcon(link.type, this._uri.resolve(link.href));
  },
  
  onContentLoaded : function(event)
  {
    if (!this._mimeType)
    {
      // Didn't find a <link rel="icon"...> so try to guess where the favicon is
      this.loadIcon("image/vnd.microsoft.icon", this._uri.prePath + "/favicon.ico");
    }
  },
  
  loadIcon : function(mimeType, uriSpec)
  {
    this._mimeType = mimeType;
    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);	
    var channel = ioService.newChannel(uriSpec, "", null);
    channel.asyncOpen(this, null);
  },
  
  onStartRequest : function(reqyest, context)
  {
    this._storageStream = Cc["@mozilla.org/storagestream;1"].createInstance(Ci.nsIStorageStream);
    this._storageStream.init(4096, PR_UINT32_MAX, null);
    var outputStream = this._storageStream.getOutputStream(0);
    this._outputStream =
      Components.classes["@mozilla.org/network/buffered-output-stream;1"].
      createInstance(Components.interfaces.nsIBufferedOutputStream);
    this._outputStream.init(outputStream, 1024);  
  },
  
  onStopRequest : function(request, context, statusCode)
  {
    if (statusCode != Components.results.NS_OK)
      return;
      
    this._outputStream.flush();
    var inputStream = this._storageStream.newInputStream(0) 
    ImageUtils.createNativeIcon(inputStream, "favicon", this._mimeType, this._targetDir);
    this._storageStream.close();
  },
  
  onDataAvailable : function(request, context, inputStream, offset, count)
  {
    this._outputStream.writeFrom(inputStream, count);
  }
};

