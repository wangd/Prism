#filter substitution
#includesubst @TOPSRCDIR@/toolkit/content/contentAreaUtils.js

function openURL(aURL)
{
  var extps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].getService(Components.interfaces.nsIExternalProtocolService);
  extps.loadURI(makeURI(aURL, null, null), null);
}