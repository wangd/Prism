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
# Contributor(s):
# Mark Finkle <mark.finkle@gmail.com>, <mfinkle@mozilla.com>
# Matthew Gertner, <matthew.gertner@gmail.com>
# Fredrik Larsson <nossralf@gmail.com>
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

const PR_WRONLY = 0x02;
const PR_CREATE_FILE = 0x08;
const PR_TRUNCATE = 0x20;
const PR_UINT32_MAX = 4294967295;

EXPORTED_SYMBOLS = ["ImageUtils"];

var ImageUtils =
{
  createNativeIcon : function(inputStream, mimeType, outputStream) {
    // Convert from source format to native icon format
    var imageTools = Cc["@mozilla.org/image/tools;1"].createInstance(Ci.imgITools);

    // The image decoders use ReadSegments, which isn't implemented on
    // file input streams. Use a buffered stream to make it work.
    var bis = Cc["@mozilla.org/network/buffered-input-stream;1"].createInstance(Ci.nsIBufferedInputStream);
    bis.init(inputStream, 1024);

    var container = {};
    imageTools.decodeImageData(bis, mimeType, container);

    var encodedStream =
      imageTools.encodeScaledImage(container.value,
      this.getNativeIconMimeType(), container.value.width,
      container.value.height);

    outputStream.writeFrom(encodedStream, encodedStream.available());
    outputStream.close();
  },

  createNativeIconFromFile : function(file) {
    var inputStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    inputStream.init(file, 0x01, 00004, null);

    var fileName = file.leafName;
    var fileExt = fileName.substring(fileName.lastIndexOf("."), fileName.length).toLowerCase();

    var mimeType = this.getMimeTypeFromExtension(fileExt);

    // The image decoders use ReadSegments, which isn't implemented on
    // file input streams. Use a buffered stream to make it work.
    var bis = Cc["@mozilla.org/network/buffered-input-stream;1"].
              createInstance(Ci.nsIBufferedInputStream);
    bis.init(inputStream, 1024);

    var storageStream = Cc["@mozilla.org/storagestream;1"].createInstance(Ci.nsIStorageStream);
    storageStream.init(4096, PR_UINT32_MAX, null);

    var bss = Cc["@mozilla.org/network/buffered-output-stream;1"].
              createInstance(Ci.nsIBufferedOutputStream);
    bss.init(storageStream.getOutputStream(0), 1024);

    this.createNativeIcon(bis, mimeType, bss);

    return storageStream;
  },

  getNativeIconExtension : function()
  {
#ifdef XP_MACOSX
    return ".icns";
#else
#ifdef XP_UNIX
    return ".png";
#else
    return ".ico";
#endif
#endif
  },

  getNativeIconMimeType : function()
  {
#ifdef XP_MACOSX
    return "image/x-icns";
#else
#ifdef XP_UNIX
    return "image/png";
#else
    return "image/vnd.microsoft.icon";
#endif
#endif
  },

  getNativeThrobberSpec : function()
  {
#ifdef XP_MACOSX
    return "chrome://global/skin/icons/loading_16_grey.gif";
#else
#ifdef XP_UNIX
    return "chrome://global/skin/throbber/Throbber-small.gif";
#else
    return "chrome://global/skin/throbber/Throbber-small.gif";
#endif
#endif
  },

  getMimeTypeFromExtension : function(imageExt) {
    mimeSvc = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);
    imageExt = imageExt.toLowerCase();
    var dotPos = imageExt.lastIndexOf(".");
    if (dotPos != -1)
      imageExt = imageExt.substring(dotPos + 1, imageExt.length);
    return mimeSvc.getTypeFromExtension(imageExt);
  },

  makeDataURL : function(inputStream, mimetype) {
    var stream = Cc["@mozilla.org/binaryinputstream;1"].createInstance();
    stream.QueryInterface(Ci.nsIBinaryInputStream);
    stream.setInputStream(inputStream);

    var bytes = stream.readByteArray(stream.available()); // returns int[]

    return "data:" + mimetype + ";base64," + btoa(String.fromCharCode.apply(null, bytes));
  },

  createStorageStream : function()
  {
    var storageStream = Cc["@mozilla.org/storagestream;1"].createInstance(Ci.nsIStorageStream);
    storageStream.init(4096, PR_UINT32_MAX, null);
    return storageStream;
  },

  getBufferedOutputStream : function(storageStream)
  {
    var outputStream = storageStream.getOutputStream(0);
    var bufferedStream = Cc["@mozilla.org/network/buffered-output-stream;1"].
                         createInstance(Ci.nsIBufferedOutputStream);
    bufferedStream.init(outputStream, 1024);
    return bufferedStream;
  }
};
