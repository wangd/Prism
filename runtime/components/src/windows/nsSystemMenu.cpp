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

#include "nsSystemMenu.h"

#include "nsArrayEnumerator.h"
#include "nsIDOMDocument.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIDOMElement.h"
#include "nsIDOMEvent.h"
#include "nsIDOMEventTarget.h"
#include "nsIDOMEventListener.h"
#include "nsIDOMWindow.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(nsSystemMenu, nsINativeMenu)

nsInterfaceHashtable<nsUint32HashKey, nsSystemMenu> nsSystemMenu::mSystemMenuMap;
PRBool mapInitialized = PR_FALSE;

nsSystemMenu::nsSystemMenu(HWND hWnd, nsIDOMDocument* aDocument) : mWnd(hWnd), mDocument(aDocument), mWndProc(NULL), mItemCount(0)
{
}

nsSystemMenu::~nsSystemMenu()
{
}

NS_IMETHODIMP nsSystemMenu::GetHandle(void** _retval)
{
  HMENU hSystemMenu = ::GetSystemMenu(mWnd, FALSE);
  if (!hSystemMenu) {
    return NS_ERROR_FAILURE;
  }
  
  *_retval = (void *) hSystemMenu;
  return NS_OK;
}

NS_IMETHODIMP nsSystemMenu::AddMenuItem(const nsAString& aId, const nsAString& aLabel, nsIDOMEventListener* aListener)
{
  NS_ENSURE_STATE(mDocument);
  NS_ENSURE_STATE(mWnd);

  // Get the element with the associated id from the document
  HMENU hSystemMenu = ::GetSystemMenu(mWnd, FALSE);
  NS_ENSURE_TRUE(hSystemMenu, NS_ERROR_UNEXPECTED);

  if (mItemCount == 0)
    ::InsertMenuW(hSystemMenu, 0, MF_SEPARATOR|MF_BYPOSITION, 0, 0);
    
  PRUint32 itemId = nsStringHashKey::HashKey(&aId);

  if (!::InsertMenuW(hSystemMenu, mItemCount, MF_STRING|MF_BYPOSITION, itemId, nsString(aLabel).get())) {
    return NS_ERROR_FAILURE;
  }
    
  mItemCount++;
    
  // Set the pointer to the element
  MENUITEMINFO itemInfo;
  itemInfo.cbSize = sizeof(itemInfo);
  itemInfo.fMask = MIIM_DATA;
  itemInfo.dwItemData = (DWORD_PTR) aListener;
  ::SetMenuItemInfo(hSystemMenu, itemId, FALSE, &itemInfo);

  // Subclass the window so we get the WM_SYSCOMMAND messages
  if (!mWndProc) {
    mWndProc = (WNDPROC) ::SetWindowLong(mWnd, GWL_WNDPROC, (LONG) nsSystemMenu::WindowProc);
  }

  return NS_OK;
}

NS_IMETHODIMP nsSystemMenu::AddSubmenu(const nsAString& aId, const nsAString& aLabel, nsINativeMenu** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemMenu::RemoveMenuItem(const nsAString& aId)
{
  NS_ENSURE_STATE(mWnd);

  HMENU hSystemMenu = ::GetSystemMenu(mWnd, FALSE);
  PRUint32 itemId = nsStringHashKey::HashKey(&aId);
  ::RemoveMenu(hSystemMenu, itemId, MF_BYCOMMAND);
  mItemCount--;

  if (mItemCount == 0) {
     // Remove the separator
     ::RemoveMenu(hSystemMenu, 0, MF_BYPOSITION);
  }

  return NS_OK;
}

NS_IMETHODIMP
nsSystemMenu::RemoveAllMenuItems()
{
  NS_ENSURE_STATE(mWnd);
  
  HMENU hSystemMenu = ::GetSystemMenu(mWnd, FALSE);
  PRUint32 index;
  for (index=mItemCount; index>0; index--) {
    ::RemoveMenu(hSystemMenu, index-1, MF_BYPOSITION);
  }
  
  mItemCount = 0;
  
  return NS_OK;
}

NS_IMETHODIMP
nsSystemMenu::GetItems(nsISimpleEnumerator** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

nsresult nsSystemMenu::GetSystemMenu(HWND hWnd, nsIDOMDocument* aDocument, nsINativeMenu** _retval)
{
  if (!mapInitialized) {
    mSystemMenuMap.Init(1);
    mapInitialized = PR_TRUE;
  }

  nsSystemMenu* systemMenu;
  if (!mSystemMenuMap.Get((PRUint32) hWnd, &systemMenu)) {
    systemMenu = new nsSystemMenu(hWnd, aDocument);
    NS_ENSURE_TRUE(systemMenu, NS_ERROR_OUT_OF_MEMORY);

    mSystemMenuMap.Put((PRUint32) hWnd, systemMenu);
  }

  return systemMenu->QueryInterface(NS_GET_IID(nsINativeMenu), (void **) _retval);
}

LRESULT APIENTRY nsSystemMenu::WindowProc(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam)
{
  nsSystemMenu* menu;
  if (!nsSystemMenu::mSystemMenuMap.Get((PRUint32) hWnd, &menu))
    return 0;

  WNDPROC oldProc = menu->mWndProc;

  if (uMsg == WM_SYSCOMMAND && wParam < 0xf000) {
    HMENU hSystemMenu = ::GetSystemMenu(hWnd, FALSE);
    MENUITEMINFO itemInfo;
    itemInfo.cbSize = sizeof(itemInfo);
    itemInfo.fMask = MIIM_DATA;

    if (!::GetMenuItemInfo(hSystemMenu, LOWORD(wParam), FALSE, &itemInfo))
      return TRUE;

    nsCOMPtr<nsIDOMEventListener> listener = (nsIDOMEventListener *) itemInfo.dwItemData;
    if (!listener)
      return TRUE;
      
    nsCOMPtr<nsIDOMDocumentEvent> documentEvent(do_QueryInterface(menu->mDocument));
    if (!documentEvent)
      return TRUE;
    
    nsCOMPtr<nsIDOMEvent> event;
    documentEvent->CreateEvent(NS_LITERAL_STRING("Events"), getter_AddRefs(event));
    if (!event)
      return TRUE;

    event->InitEvent(NS_LITERAL_STRING("command"), PR_TRUE, PR_TRUE);
    listener->HandleEvent(event);

    return FALSE;
  }
  else if (uMsg == WM_CLOSE) {
    ::SetWindowLong(hWnd, GWL_WNDPROC, (LONG) oldProc);
    nsSystemMenu::mSystemMenuMap.Remove((PRUint32) hWnd);
  }

  return ::CallWindowProc(oldProc, hWnd, uMsg, wParam, lParam);
}
