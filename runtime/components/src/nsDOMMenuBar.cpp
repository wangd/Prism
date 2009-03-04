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

/* Development of this Contribution was supported by Yahoo! Inc. */

#include "nsDOMMenuBar.h"
#include "nsAutoPtr.h"
#include "nsIDocShellTreeItem.h"
#include "nsIDOMAbstractView.h"
#include "nsIDOMDocument.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIDOMElement.h"
#include "nsIDOMEventListener.h"
#include "nsIDOMEventTarget.h"
#include "nsIDOMNodeList.h"
#include "nsIDOMWindow.h"
#include "nsIDOMXULElement.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIDOMUIEvent.h"
#include "nsIWebNavigation.h"

NS_IMPL_ISUPPORTS1(nsDOMMenuBar, nsINativeMenu)

nsDOMMenuBar::nsDOMMenuBar(nsIDOMWindow* aWindow) : mWindow(aWindow)
{
}

nsDOMMenuBar::~nsDOMMenuBar()
{
}

NS_IMETHODIMP nsDOMMenuBar::GetHandle(void** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDOMMenuBar::AddMenuItem(const nsAString& aId, const nsAString& aLabel, nsIDOMEventListener* aListener)
{
  NS_ENSURE_STATE(mWindow);
  NS_ENSURE_STATE(mMenuElement);
  
  nsresult rv;
  nsAutoString tagName;
  rv = mMenuElement->GetTagName(tagName);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (tagName != NS_LITERAL_STRING("menu")) {
    return NS_ERROR_FAILURE;
  }
  
  nsCOMPtr<nsIDOMDocument> document;
  rv = GetChromeDocument(getter_AddRefs(document));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMElement> element;
  rv = document->CreateElement(NS_LITERAL_STRING("menuitem"), getter_AddRefs(element));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMXULElement> xulElement(do_QueryInterface(element, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = xulElement->SetId(aId);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = element->SetAttribute(NS_LITERAL_STRING("label"), aLabel);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMEventTarget> target(do_QueryInterface(element, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = target->AddEventListener(NS_LITERAL_STRING("command"), aListener, PR_TRUE);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMNode> node;
  rv = mMenuElement->AppendChild(element, getter_AddRefs(node));
  NS_ENSURE_SUCCESS(rv, rv);
  
  return NS_OK;
}

NS_IMETHODIMP nsDOMMenuBar::AddSubmenu(const nsAString& aId, const nsAString& aLabel, nsINativeMenu** _retval)
{
  nsresult rv;
  nsCOMPtr<nsIDOMDocument> chromeDocument;
  rv = GetChromeDocument(getter_AddRefs(chromeDocument));
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (!mMenuElement) {
    nsCOMPtr<nsIDOMNodeList> nodeList;
    rv = chromeDocument->GetElementsByTagName(NS_LITERAL_STRING("menubar"), getter_AddRefs(nodeList));
    NS_ENSURE_SUCCESS(rv, rv);
    
    nsCOMPtr<nsIDOMNode> node;
    rv = nodeList->Item(0, getter_AddRefs(node));
    NS_ENSURE_SUCCESS(rv, rv);
    
    mMenuElement = do_QueryInterface(node, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    
    rv = mMenuElement->SetAttribute(NS_LITERAL_STRING("hidden"), NS_LITERAL_STRING("false"));
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  // Add the new menu
  nsCOMPtr<nsIDOMElement> menu;
  rv = chromeDocument->CreateElement(NS_LITERAL_STRING("menu"), getter_AddRefs(menu));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = menu->SetAttribute(NS_LITERAL_STRING("label"), aLabel);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMElement> menuPopup;
  rv = chromeDocument->CreateElement(NS_LITERAL_STRING("menupopup"), getter_AddRefs(menuPopup));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMXULElement> xulElement(do_QueryInterface(menuPopup, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = xulElement->SetId(aId);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMNode> node;
  rv = menu->AppendChild(menuPopup, getter_AddRefs(node));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = mMenuElement->AppendChild(menu, getter_AddRefs(node));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsRefPtr<nsDOMMenuBar> nativeMenu = new nsDOMMenuBar(mWindow);
  NS_ENSURE_TRUE(nativeMenu, NS_ERROR_OUT_OF_MEMORY);
  
  nativeMenu->mMenuElement = menu;

  return nativeMenu->QueryInterface(NS_GET_IID(nsINativeMenu), (void **) _retval);
}

NS_IMETHODIMP nsDOMMenuBar::RemoveMenuItem(const nsAString& aId)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDOMMenuBar::RemoveAllMenuItems()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDOMMenuBar::GetItems(nsISimpleEnumerator** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

nsresult nsDOMMenuBar::GetChromeDocument(nsIDOMDocument** _retval)
{
  NS_ENSURE_STATE(mWindow);
  
  nsresult rv;
  nsCOMPtr<nsIWebNavigation> webNav(do_GetInterface(mWindow, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDocShellTreeItem> treeItem(do_QueryInterface(webNav, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDocShellTreeItem> rootItem;
  rv = treeItem->GetRootTreeItem(getter_AddRefs(rootItem));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMWindow> chromeWindow(do_GetInterface(rootItem, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  return chromeWindow->GetDocument(_retval);
}
