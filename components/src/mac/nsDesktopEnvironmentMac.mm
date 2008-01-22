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
 * The Original Code is WebRunner
 *
 * The Initial Developer of the Original Code is
 * Matthew Gertner.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Matthew Gertner <matthew@allpeers.com> (Original author)
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

#import <Foundation/Foundation.h>

#include "nsDesktopEnvironmentMac.h"

#include "nsCOMPtr.h"
#include "nsDockTile.h"
#include "nsIFile.h"
#include "nsIProperties.h"
#include "nsServiceManagerUtils.h"
#include "nsStringAPI.h"

NS_IMPL_ISUPPORTS2(nsDesktopEnvironment, nsIDesktopEnvironment, nsIMacDock)

nsDesktopEnvironment::nsDesktopEnvironment()
{
}

nsDesktopEnvironment::~nsDesktopEnvironment()
{
}

NS_IMETHODIMP nsDesktopEnvironment::CreateShortcut(
  const nsAString& aName,
  nsIFile* aTarget,
  nsIFile* aLocation,
  const nsAString& aWorkingPath,
  const nsAString& aArguments,
  const nsAString& aDescription,
  nsIFile* aIcon,
  nsIFile** _retval
)
{
  NS_ENSURE_ARG(aTarget);
  NS_ENSURE_ARG(aLocation);

  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::AddApplication(nsIFile* aAppBundle)
{
  NS_ENSURE_ARG(aAppBundle);
 
  nsresult rv;
  nsCOMPtr<nsIProperties>
    dirSvc(do_GetService("@mozilla.org/file/directory_service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> preferences;
  rv = dirSvc->Get("UsrPrfs", NS_GET_IID(nsIFile), getter_AddRefs(preferences));
  NS_ENSURE_SUCCESS(rv, rv);
 
  rv = preferences->Append(NS_LITERAL_STRING("com.apple.dock.plist"));
  NS_ENSURE_SUCCESS(rv, rv);
 
  nsAutoString path;
  rv = preferences->GetPath(path);
  NS_ENSURE_SUCCESS(rv, rv);
 
  NSString* prefPath = [NSString stringWithCharacters:path.get() length:path.Length()];
 
  NSMutableDictionary* dictionary = [NSMutableDictionary dictionaryWithContentsOfFile:prefPath];
   
  nsAutoString bundlePath;
  rv = aAppBundle->GetPath(bundlePath);
  NS_ENSURE_SUCCESS(rv, rv);
 
  NSMutableDictionary* appData = [NSMutableDictionary dictionaryWithCapacity:1];
  NSMutableDictionary* tileData = [NSMutableDictionary dictionaryWithCapacity:1];
  NSMutableDictionary* fileData = [NSMutableDictionary dictionaryWithCapacity:3];
  [fileData setValue:[NSString stringWithCharacters:bundlePath.get() length:bundlePath.Length()]
    forKey:@"_CFURLString"];
  [fileData setValue:[NSNumber numberWithInt:0] forKey:@"_CFURLStringType"];
 
  [tileData setValue:fileData forKey:@"file-data"];
  [appData setValue:tileData forKey:@"tile-data"];
 
  NSMutableArray* persistentApps = (NSMutableArray *) [dictionary valueForKey:@"persistent-apps"];
  [persistentApps addObject:appData];
 
  [dictionary writeToFile:prefPath atomically:YES];
 
  // Restart the dock using AppleScript
  NSDictionary* errorDict;
  NSAppleScript* scriptObject = [[NSAppleScript alloc] initWithSource:@"quit application \"Dock\""];
  [scriptObject executeAndReturnError: &errorDict];
  [scriptObject release];
 
  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::RemoveApplication(nsIFile* aAppBundle)
{
  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::GetApplicationTile(nsIApplicationTile** _retval)
{
  if (!mDockTile)
  {
    mDockTile = new nsDockTile;
    NS_ENSURE_TRUE(mDockTile, NS_ERROR_OUT_OF_MEMORY);
  }
 
  NS_ADDREF(*_retval = mDockTile);
 
  return NS_OK;
}
