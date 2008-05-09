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

#include "nsSystemMenu.h"

#include "nsArrayEnumerator.h"
#include "nsIDOMDocument.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIDOMElement.h"
#include "nsIDOMEvent.h"
#include "nsIDOMEventTarget.h"
#include "nsIDOMWindow.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(nsSystemMenu, nsINativeMenu)

nsInterfaceHashtable<nsUint32HashKey, nsSystemMenu> nsSystemMenu::mSystemMenuMap;
PRBool mapInitialized = PR_FALSE;

nsSystemMenu::nsSystemMenu(HWND hWnd, nsIDOMDocument* aDocument)
{
  mWnd = hWnd;
  mDocument = aDocument;
  mWndProc = NULL;
}

nsSystemMenu::~nsSystemMenu()
{
}

NS_IMETHODIMP nsSystemMenu::AddMenuItem(const nsAString& aId)
{
  NS_ENSURE_STATE(mDocument);
  NS_ENSURE_STATE(mWnd);

  nsresult rv;

  // Get the element with the associated id from the document
  nsCOMPtr<nsIDOMElement> element;
  rv = mDocument->GetElementById(aId, getter_AddRefs(element));
  NS_ENSURE_SUCCESS(rv, rv);

  if (!element)
    return NS_ERROR_NOT_AVAILABLE;

  // Add the element to the system menu
  nsAutoString label;
  rv = element->GetAttribute(NS_LITERAL_STRING("label"), label);
  NS_ENSURE_SUCCESS(rv, rv);

  HMENU hSystemMenu = ::GetSystemMenu(mWnd, FALSE);
  NS_ENSURE_TRUE(hSystemMenu, NS_ERROR_UNEXPECTED);

  mItems.AppendObject(element);

  if (mItems.Count() == 1)
    ::InsertMenuW(hSystemMenu, 0, MF_SEPARATOR|MF_BYPOSITION, 0, 0);

  if (!::InsertMenuW(hSystemMenu, mItems.Count()-1, MF_STRING|MF_BYPOSITION, mItems.Count(), label.get()))
    return NS_ERROR_FAILURE;

  // Subclass the window so we get the WM_SYSCOMMAND messages
  if (!mWndProc)
    mWndProc = (WNDPROC) ::SetWindowLong(mWnd, GWL_WNDPROC, (LONG) nsSystemMenu::WindowProc);

  return NS_OK;
}

NS_IMETHODIMP nsSystemMenu::RemoveMenuItem(const nsAString& aId)
{
  NS_ENSURE_STATE(mWnd);

  nsresult rv;
  nsCOMPtr<nsIDOMElement> element;
  rv = mDocument->GetElementById(aId, getter_AddRefs(element));
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 index = mItems.IndexOf(element);
  if (index == nsTArray<nsIDOMElement*>::NoIndex)
    return NS_ERROR_NOT_AVAILABLE;

  HMENU hSystemMenu = ::GetSystemMenu(mWnd, FALSE);
  ::RemoveMenu(hSystemMenu, index, MF_BYPOSITION);
  if (mItems.Count() == 1)
     // Remove the separator
     ::RemoveMenu(hSystemMenu, 0, MF_BYPOSITION);

  mItems.RemoveObjectAt(index);

  return NS_OK;
}

NS_IMETHODIMP
nsSystemMenu::GetItems(nsISimpleEnumerator** _retval)
{
  return NS_NewArrayEnumerator(_retval, mItems);
}

nsresult nsSystemMenu::OnItemSelected(PRUint32 itemIndex, PRBool* preventDefault)
{
  nsresult rv;
  NS_ENSURE_TRUE(itemIndex < mItems.Count(), NS_ERROR_NOT_AVAILABLE);

  nsCOMPtr<nsIDOMElement> element = mItems[itemIndex];
  nsCOMPtr<nsIDOMDocumentEvent> documentEvent(do_QueryInterface(mDocument, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMEvent> event;
  rv = documentEvent->CreateEvent(NS_LITERAL_STRING("Events"), getter_AddRefs(event));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = event->InitEvent(NS_LITERAL_STRING("command"), PR_TRUE, PR_TRUE);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMEventTarget> target(do_QueryInterface(element, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  return target->DispatchEvent(event, preventDefault);
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
    PRBool preventDefault;
    // Subtract one since we start the ids at one instead of zero.
    if (NS_SUCCEEDED(menu->OnItemSelected((PRUint32) wParam-1, &preventDefault)) && preventDefault)
      return 0;
  }
  else if (uMsg == WM_CLOSE) {
    ::SetWindowLong(hWnd, GWL_WNDPROC, (LONG) oldProc);
    nsSystemMenu::mSystemMenuMap.Remove((PRUint32) hWnd);
  }

  return ::CallWindowProc(oldProc, hWnd, uMsg, wParam, lParam);
}
