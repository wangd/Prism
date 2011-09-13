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
# The Initial Developer of the Original Code is
# Mark Finkle.
#
# Contributor(s):
# Matthew Gertner, <matthew.gertner@gmail.com>
# Mark Finkle, <mark.finkle@gmail.com>, <mfinkle@mozilla.com>
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

addEventListener("load", onload, false);

function onload(aEvent)
{
  if (aEvent.target != document)
    return;

  var bundle = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
  bundle = bundle.createBundle("chrome://branding/content/brand.properties");

  var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);

  var version = document.getElementById("version");
  version.value = bundle.GetStringFromName("brandFullName") + " " + appInfo.version;

  var userAgent = document.getElementById("useragent");
  userAgent.value = navigator.userAgent;

  var credits = document.getElementById("credits");
  if (window.arguments && window.arguments[0]) {
    credits.value = window.arguments[0].credits.replace("\\n", "\n", "g");
  }

  if (credits.value.length == 0) {
    document.getElementById("box_credits").hidden = true;
    document.getElementById("about").height -= 50;
  }

  document.documentElement.getButton("accept").focus();
}
