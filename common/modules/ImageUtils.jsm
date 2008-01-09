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

const PR_WRONLY = 0x02;
const PR_CREATE_FILE = 0x08;
const PR_TRUNCATE = 0x20;

EXPORTED_SYMBOLS = ["ImageUtils"];

var ImageUtils =
{
  createNativeIcon : function(inputStream, fileTitle, mimeType, outputStream) {
    // Convert from source format to native icon format
    var imageTools = Components.classes["@mozilla.org/image/tools;1"].
      createInstance(Components.interfaces.imgITools);

    var container = {};
    imageTools.decodeImageData(inputStream, mimeType, container);

    var encodedStream =
      imageTools.encodeScaledImage(container.value,
      this.getNativeIconMimeType(), container.value.width,
      container.value.height);

    outputStream.writeFrom(encodedStream, encodedStream.available());
    outputStream.close();
  },

  getNativeIconExtension : function()
  {
    var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    var os = xulRuntime.OS.toLowerCase();
    if (os == "winnt")
      return ".ico";
    else if (os == "linux")
      return ".xpm";
    else if (os == "darwin")
      return ".icns";
  },

  getNativeIconMimeType : function()
  {
    var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    var os = xulRuntime.OS.toLowerCase();
    if (os == "winnt")
      return "image/vnd.microsoft.icon";
    else if (os == "linux")
      return "image/xpm";
    else if (os == "darwin")
      return "image/x-icns";
  }
};
