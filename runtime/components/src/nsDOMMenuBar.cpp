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
#include "nsIBoxObject.h"
#include "nsIContainerBoxObject.h"
#include "nsIDocShell.h"
#include "nsIDocShellTreeItem.h"
#include "nsIDOMAbstractView.h"
#include "nsIDOMDocument.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIDOMElement.h"
#include "nsIDOMEventTarget.h"
#include "nsIDOMNodeList.h"
#include "nsIDOMWindow.h"
#include "nsIDOMXULElement.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIDOMUIEvent.h"
#include "nsIWebNavigation.h"

NS_IMPL_ISUPPORTS2(nsDOMMenuBar, nsINativeMenu, nsIDOMEventListener)

nsDOMMenuBar::nsDOMMenuBar(nsIDOMWindow* aWindow) : mWindow(aWindow)
{
}

nsDOMMenuBar::~nsDOMMenuBar()
{
}

NS_IMETHODIMP nsDOMMenuBar::AddMenuItem(const nsAString& aId)
{
  NS_ENSURE_STATE(mWindow);

  nsresult rv;
  nsCOMPtr<nsIDOMDocument> document;
  rv = mWindow->GetDocument(getter_AddRefs(document));
  NS_ENSURE_SUCCESS(rv, rv);
  
  // Get the element with the associated id from the document
  nsCOMPtr<nsIDOMElement> element;
  rv = document->GetElementById(aId, getter_AddRefs(element));
  NS_ENSURE_SUCCESS(rv, rv);

  if (!element)
    return NS_ERROR_NOT_AVAILABLE;
    
  nsCOMPtr<nsIWebNavigation> webNav(do_GetInterface(mWindow, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDocShellTreeItem> treeItem(do_QueryInterface(webNav, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDocShellTreeItem> rootItem;
  rv = treeItem->GetRootTreeItem(getter_AddRefs(rootItem));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMWindow> chromeWindow(do_GetInterface(rootItem, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMDocument> chromeDocument;
  rv = chromeWindow->GetDocument(getter_AddRefs(chromeDocument));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMNodeList> nodeList;
  rv = chromeDocument->GetElementsByTagName(NS_LITERAL_STRING("menubar"), getter_AddRefs(nodeList));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMNode> node;
  rv = nodeList->Item(0, getter_AddRefs(node));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMElement> menuBar(do_QueryInterface(node, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMElement> xulMenu;
  rv = CreateXULMenu(chromeDocument, element, aId, getter_AddRefs(xulMenu));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = menuBar->AppendChild(xulMenu, getter_AddRefs(node));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = menuBar->SetAttribute(NS_LITERAL_STRING("hidden"), NS_LITERAL_STRING("false"));
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

nsresult nsDOMMenuBar::CreateXULMenu(nsIDOMDocument* aDocument, nsIDOMElement* aElement,
  const nsAString& aId, nsIDOMElement** _retval)
{
  nsresult rv;
  nsAutoString tagName;
  rv = aElement->GetTagName(tagName);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (tagName != NS_LITERAL_STRING("MENU"))
    return NS_ERROR_INVALID_ARG;

  // Add the new menu
  nsAutoString label;
  rv = aElement->GetAttribute(NS_LITERAL_STRING("label"), label);
  NS_ENSURE_SUCCESS(rv, rv);
 
  nsCOMPtr<nsIDOMElement> menu;
  rv = aDocument->CreateElement(NS_LITERAL_STRING("menu"), getter_AddRefs(menu));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMXULElement> xulElement(do_QueryInterface(menu, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = xulElement->SetId(aId);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = menu->SetAttribute(NS_LITERAL_STRING("label"), label);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMElement> menuPopup;
  rv = aDocument->CreateElement(NS_LITERAL_STRING("menupopup"), getter_AddRefs(menuPopup));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMNode> node;
  rv = menu->AppendChild(menuPopup, getter_AddRefs(node));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = aElement->GetFirstChild(getter_AddRefs(node));
  NS_ENSURE_SUCCESS(rv, rv);
  
  while (node) {
    nsCOMPtr<nsIDOMElement> child(do_QueryInterface(node, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    
    rv = child->GetAttribute(NS_LITERAL_STRING("label"), label);
    NS_ENSURE_SUCCESS(rv, rv);
    
    nsAutoString id;
    rv = child->GetAttribute(NS_LITERAL_STRING("id"), id);
    NS_ENSURE_SUCCESS(rv, rv);
    
    rv = child->GetTagName(tagName);
    NS_ENSURE_SUCCESS(rv, rv);
    
    nsCOMPtr<nsIDOMElement> menuItem;
    if (tagName == NS_LITERAL_STRING("COMMAND")) {
      rv = aDocument->CreateElement(NS_LITERAL_STRING("menuitem"), getter_AddRefs(menuItem));
      NS_ENSURE_SUCCESS(rv, rv);

      // Remember the ID of the element that we are delegating to
      rv = menuItem->SetAttribute(NS_LITERAL_STRING("delegate"), id);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsIDOMEventTarget> eventTarget(do_QueryInterface(menuItem, &rv));
      NS_ENSURE_SUCCESS(rv, rv);

      rv = eventTarget->AddEventListener(NS_LITERAL_STRING("command"), this, PR_FALSE);
      NS_ENSURE_SUCCESS(rv, rv);
    }
    else if (tagName == NS_LITERAL_STRING("MENU")) {
      rv = CreateXULMenu(aDocument, child, id, getter_AddRefs(menuItem));
      NS_ENSURE_SUCCESS(rv, rv);
    }
    else {
      NS_WARNING("Unknown menu item");
    }

    if (menuItem) {
      rv = menuItem->SetAttribute(NS_LITERAL_STRING("label"), label);
      NS_ENSURE_SUCCESS(rv, rv);
      
      rv = menuPopup->AppendChild(menuItem, getter_AddRefs(node));
      NS_ENSURE_SUCCESS(rv, rv);
    }
    
    nsCOMPtr<nsIDOMNode> sibling;
    rv = child->GetNextSibling(getter_AddRefs(node));
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  NS_ADDREF(*_retval = menu);
  
  return NS_OK;
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

NS_IMETHODIMP nsDOMMenuBar::HandleEvent(nsIDOMEvent* aEvent)
{
  NS_ENSURE_STATE(mWindow);

  nsresult rv;
  nsCOMPtr<nsIDOMDocument> document;
  rv = mWindow->GetDocument(getter_AddRefs(document));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMEventTarget> eventTarget;
  rv = aEvent->GetTarget(getter_AddRefs(eventTarget));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMElement> menuItem(do_QueryInterface(eventTarget, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAutoString delegateId;
  rv = menuItem->GetAttribute(NS_LITERAL_STRING("delegate"), delegateId);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMElement> targetElement;
  rv = document->GetElementById(delegateId, getter_AddRefs(targetElement));
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (!targetElement)
    return NS_ERROR_NOT_AVAILABLE;
    
  nsCOMPtr<nsIDOMDocumentEvent> documentEvent(do_QueryInterface(document, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
    
  nsCOMPtr<nsIDOMEvent> event;
  rv = documentEvent->CreateEvent(NS_LITERAL_STRING("UIEvents"), getter_AddRefs(event));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMUIEvent> uiEvent(do_QueryInterface(event, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMAbstractView> view(do_QueryInterface(mWindow, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = uiEvent->InitUIEvent(NS_LITERAL_STRING("DOMActivate"), PR_TRUE, PR_TRUE, view, 0);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIDOMEventTarget> target(do_QueryInterface(targetElement, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  PRBool preventDefault;
  rv = target->DispatchEvent(uiEvent, &preventDefault);
  NS_ENSURE_SUCCESS(rv, rv);
  
  return NS_OK;
}