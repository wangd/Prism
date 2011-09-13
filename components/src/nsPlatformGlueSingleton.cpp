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
 * The Original Code is Mozilla Prism
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

/* Development of this Contribution was supported by Yahoo! Inc. */

#include "nsPlatformGlueSingleton.h"

#include "nsComponentManagerUtils.h"
#include "nsICategoryManager.h"
#include "nsIObserverService.h"
#include "nsIPrefBranch.h"
#include "nsIPlatformGlueInternal.h"
#include "nsServiceManagerUtils.h"
#include "nsStringAPI.h"

#define PRISM_PROTOCOL_PREFIX "prism.protocol."

NS_IMPL_ISUPPORTS1(nsPlatformGlueSingleton, nsIObserver)

nsPlatformGlueSingleton::nsPlatformGlueSingleton()
{
}

nsPlatformGlueSingleton::~nsPlatformGlueSingleton()
{
}

NS_METHOD nsPlatformGlueSingleton::OnRegistration(nsIComponentManager *aCompMgr,
    nsIFile *aPath, const char *registryLocation, const char *componentType,
    const nsModuleComponentInfo *info)
{
  nsresult rv = NS_OK;

  // Get category manager
  nsCOMPtr<nsICategoryManager> categoryManager(do_GetService(NS_CATEGORYMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // Register plugin as an observer for app startup event.
  rv = categoryManager->AddCategoryEntry("app-startup",
    "nsPlatformGlueSingleton",
    "service," NS_PLATFORMGLUESINGLETON_CONTRACTID,
    PR_TRUE,  // persist category
    PR_TRUE,  // replace existing
    nsnull);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_METHOD nsPlatformGlueSingleton::OnUnregistration(nsIComponentManager *aCompMgr,
    nsIFile *aPath, const char *registryLocation,
    const nsModuleComponentInfo *info)
{
  nsresult rv = NS_OK;

  // Get category manager
  nsCOMPtr<nsICategoryManager> categoryManager(do_GetService(NS_CATEGORYMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // Unregister observer.
  rv = categoryManager->DeleteCategoryEntry("app-startup", "nsPlatformGlueSingleton", PR_TRUE);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_IMETHODIMP nsPlatformGlueSingleton::Observe(nsISupports* aSubject, const char* aTopic, const PRUnichar* aData)
{
  nsresult rv;
  if (strcmp(aTopic, "app-startup") == 0) {
    nsCOMPtr<nsIObserverService> observerService(do_GetService("@mozilla.org/observer-service;1", &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    
    rv = observerService->AddObserver(this, "profile-after-change", false);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else if (strcmp(aTopic, "profile-after-change") == 0) {
    nsCOMPtr<nsIPrefBranch> prefs(do_GetService("@mozilla.org/preferences-service;1", &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    
    PRUint32 protocolCount;
    char** protocols;
    rv = prefs->GetChildList(PRISM_PROTOCOL_PREFIX, &protocolCount, &protocols);
    NS_ENSURE_SUCCESS(rv, rv);
    
    nsCOMPtr<nsIPlatformGlueInternal> platformGlue(do_CreateInstance("@mozilla.org/platform-web-api;1", &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    
    for (PRUint32 i=0; i<protocolCount; i++) {
      rv = platformGlue->RegisterProtocolFactory(NS_ConvertUTF8toUTF16(nsCString(protocols[i]+strlen(PRISM_PROTOCOL_PREFIX))));
      NS_ENSURE_SUCCESS(rv, rv);
    }
  }

  return NS_OK;
}
