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

#include "nsNativeMenu.h"

#include "nsHashKeys.h"
#include "nsIDOMEventListener.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(nsNativeMenu, nsINativeMenu)

nsNativeMenu::nsNativeMenu(HMENU aMenu)
{
  mMenu = aMenu;
}

nsNativeMenu::~nsNativeMenu()
{
  RemoveAllMenuItems();
  ::DestroyMenu(mMenu);
}

NS_IMETHODIMP nsNativeMenu::GetHandle(void** _retval)
{
  *_retval = (void *) mMenu;

  return NS_OK;
}

NS_IMETHODIMP
nsNativeMenu::AddMenuItem(const nsAString& aId, const nsAString& aLabel, nsIDOMEventListener* aListener)
{
  NS_ENSURE_ARG(aListener);

  PRUint32 itemId = nsStringHashKey::HashKey(&aId) % PR_UINT16_MAX;
  ::AppendMenuW(mMenu, MF_STRING, itemId, nsString(aLabel).get());

  // Set the pointer to the element
  MENUITEMINFO itemInfo;
  itemInfo.cbSize = sizeof(itemInfo);
  itemInfo.fMask = MIIM_DATA;
  itemInfo.dwItemData = (DWORD_PTR) aListener;
  ::SetMenuItemInfo(mMenu, itemId, FALSE, &itemInfo);
  
  NS_ADDREF(aListener);
  
  return NS_OK;
}

nsresult nsNativeMenu::AddSubmenu(const nsAString& aId, const nsAString& aLabel, nsINativeMenu** _retval)
{
  HMENU submenu = ::CreatePopupMenu();
  nsCOMPtr<nsINativeMenu> menu = new nsNativeMenu(submenu);
  NS_ENSURE_TRUE(menu, NS_ERROR_OUT_OF_MEMORY);
  
  ::AppendMenuW(mMenu, MF_STRING|MF_POPUP, (UINT) submenu, nsString(aLabel).get());
  
  // Hold a reference to the menu until we go away
  mSubmenus.AppendObject(menu);

  *_retval = menu;
  NS_ADDREF(*_retval);
  
  return NS_OK;
}

NS_IMETHODIMP
nsNativeMenu::RemoveMenuItem(const nsAString& aId)
{
  NS_ENSURE_STATE(mMenu);

  nsresult rv;
  PRUint32 itemId = nsStringHashKey::HashKey(&aId) % PR_UINT16_MAX;

  MENUITEMINFO itemInfo;
  itemInfo.cbSize = sizeof(itemInfo);
  itemInfo.fMask = MIIM_DATA;
  if (::GetMenuItemInfo(mMenu, itemId, FALSE, &itemInfo)) {
    nsIDOMEventListener* listener = (nsIDOMEventListener *) itemInfo.dwItemData;
    NS_RELEASE(listener);
  }

  if (::RemoveMenu(mMenu, itemId, MF_BYCOMMAND) != 0) {
    return NS_OK;
  }
  else {
    return NS_ERROR_NOT_AVAILABLE;
  }
}

NS_IMETHODIMP
nsNativeMenu::RemoveAllMenuItems()
{
  if (mMenu) {
    int menuCount = ::GetMenuItemCount(mMenu);
    
    PRUint32 i;
    for (i=menuCount; i>0; i--) {
      MENUITEMINFO itemInfo;
      itemInfo.cbSize = sizeof(itemInfo);
      itemInfo.fMask = MIIM_DATA;
      if (::GetMenuItemInfo(mMenu, i, TRUE, &itemInfo)) {
        nsIDOMEventListener* listener = (nsIDOMEventListener *) itemInfo.dwItemData;
        NS_RELEASE(listener);
      }
      ::RemoveMenu(mMenu, i-1, MF_BYPOSITION);
    }
  }
  
  return NS_OK;
}

NS_IMETHODIMP
nsNativeMenu::GetItems(nsISimpleEnumerator** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
