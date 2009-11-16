/* -*- Mode: C++; tab-aWidth: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Operating System Integration extension.
 *
 * The Initial Developer of the Original Code is
 * Matthew Gertner.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Matthew Gertner <matthew.gertner@gmail.com> (Original author)
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
 *
 * ***** END LICENSE BLOCK ***** */

#include "nsIClassInfoImpl.h"
#include "nsIGenericFactory.h"
#include "nsIModule.h"
#include "nsICategoryManager.h"
#include "nsXPCOMCID.h"
#include "nsServiceManagerUtils.h"

#include "nsPlatformGlueSingleton.h"

#ifdef XP_WIN
#include "nsDesktopEnvironmentWin.h"
#include "nsICOEncoder.h"

NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsDesktopEnvironment, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsICOEncoder)
#endif

#ifdef XP_MACOSX
#include "nsICNSEncoder.h"
#include "nsDesktopEnvironmentMac.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(nsDesktopEnvironment);
NS_GENERIC_FACTORY_CONSTRUCTOR(nsICNSEncoder)
#endif

NS_GENERIC_FACTORY_CONSTRUCTOR(nsPlatformGlueSingleton)

static const nsModuleComponentInfo components[] =
{
  { "Platform glue singleton",
    NS_PLATFORMGLUESINGLETON_CID,
    NS_PLATFORMGLUESINGLETON_CONTRACTID,
    nsPlatformGlueSingletonConstructor,
    nsPlatformGlueSingleton::OnRegistration,
    nsPlatformGlueSingleton::OnUnregistration
  },
#ifdef XP_WIN
  { "Windows desktop environment",
    NS_DESKTOPENVIRONMENT_CID,
    NS_DESKTOPENVIRONMENT_CONTRACTID,
    nsDesktopEnvironmentConstructor,
    nsDesktopEnvironment::OnRegistration,
    nsDesktopEnvironment::OnUnregistration
  },
  { "ICO encoder",
    NS_ICOENCODER_CID,
    "@mozilla.org/image/encoder;2?type=image/vnd.microsoft.icon",
    nsICOEncoderConstructor
  }
#endif
#ifdef XP_MACOSX
  { "Mac OS X desktop environment",
    NS_DESKTOPENVIRONMENT_CID,
    NS_DESKTOPENVIRONMENT_CONTRACTID,
    nsDesktopEnvironmentConstructor,
  },
  { "ICNS encoder",
    NS_ICNSENCODER_CID,
    "@mozilla.org/image/encoder;2?type=image/x-icns",
    nsICNSEncoderConstructor
  }
#endif
};

NS_IMPL_NSGETMODULE(nsPlatformGlueModule, components)
