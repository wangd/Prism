/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
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

#include "nsIDesktopEnvironment.h"
#include "nsIMacDock.h"
#include "nsCOMPtr.h"

class nsIApplicationTile;
class nsIComponentManager;
class nsIFile;
struct nsModuleComponentInfo;

#define NS_DESKTOPENVIRONMENT_CID \
{ /* 4851f430-c43a-11dc-95ff-0800200c9a66 */         \
     0x4851f430,                                     \
     0xc43a,                                         \
     0x11dc,                                         \
    {0x95, 0xff, 0x08, 0x00, 0x20, 0x0c, 0x9a, 0x66} \
}
#define NS_DESKTOPENVIRONMENT_CONTRACTID "@mozilla.org/desktop-environment;1"

// Desktop integration for Mac OS X platforms.
class nsDesktopEnvironment : public nsIDesktopEnvironment, public nsIMacDock
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIDESKTOPENVIRONMENT
  NS_DECL_NSIMACDOCK

  nsDesktopEnvironment();

private:
  ~nsDesktopEnvironment();

protected:
  nsCOMPtr<nsIApplicationTile> mDockTile;
};
