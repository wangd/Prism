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

#import <Foundation/Foundation.h>
#import <Cocoa/Cocoa.h>

#include "nsCocoaMenu.h"

#include "DOMElementWrapper.h"
#include "nsIDOMDocument.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIDOMElement.h"
#include "nsIDOMEvent.h"
#include "nsIDOMEventTarget.h"
#include "nsStringAPI.h"
#include "nsTArray.h"

@interface NativeMenuDelegate : NSObject
{
  nsINativeMenu* mMenu;
}

- (id)initWithMenu:(nsINativeMenu*)menu;

@end

@implementation NativeMenuDelegate

- (id)initWithMenu:(nsINativeMenu*)menu
{
  mMenu = menu;
  NS_ADDREF(mMenu);
  return self;
}

- (void)menuItemSelected:(id)sender
{
  nsCOMPtr<nsIDOMElement> element = [[sender representedObject] element];
  nsCOMPtr<nsIDOMDocument> document;
  if (NS_FAILED(element->GetOwnerDocument(getter_AddRefs(document))))
    return;
    
  nsCOMPtr<nsIDOMDocumentEvent> documentEvent(do_QueryInterface(document));
  if (!documentEvent)
    return;

  nsCOMPtr<nsIDOMEvent> event;
  if (NS_FAILED(documentEvent->CreateEvent(NS_LITERAL_STRING("Events"), getter_AddRefs(event))))
    return;

  if (NS_FAILED(event->InitEvent(NS_LITERAL_STRING("DOMActivate"), PR_TRUE, PR_TRUE)))
    return;

  nsCOMPtr<nsIDOMEventTarget> target(do_QueryInterface(element));
  if (!target)
    return;

  PRBool preventDefault;
  target->DispatchEvent(event, &preventDefault);
}

- (void)dealloc
{
  NS_RELEASE(mMenu);
  [super dealloc];
}

@end

NS_IMPL_THREADSAFE_ISUPPORTS1(nsCocoaMenu, nsINativeMenu)

nsCocoaMenu::nsCocoaMenu(nsIDOMDocument* document, NSMenu* menu)
{
  mDocument = document;
  mMenu = menu;
  mDelegate = [[NativeMenuDelegate alloc] initWithMenu: this];
}

nsCocoaMenu::~nsCocoaMenu()
{
}

NS_IMETHODIMP nsCocoaMenu::AddMenuItem(const nsAString& aId)
{
  NS_ENSURE_STATE(mDocument);
  NS_ENSURE_STATE(mMenu);

  nsresult rv;

  // Get the element with the associated id from the document
  nsCOMPtr<nsIDOMElement> element;
  rv = mDocument->GetElementById(aId, getter_AddRefs(element));
  NS_ENSURE_SUCCESS(rv, rv);

  if (!element)
    return NS_ERROR_NOT_AVAILABLE;

  // Add the element to the menu
  nsAutoString label;
  rv = element->GetAttribute(NS_LITERAL_STRING("label"), label);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (mItems.Count() == 0) {
    // Insert separator after first item
    [mMenu insertItem: [NSMenuItem separatorItem] atIndex: 0];
  }
  
  NSMenuItem* item = [mMenu insertItemWithTitle: [NSString stringWithCharacters:label.get() length:label.Length()]
         action: @selector (menuItemSelected:)
         keyEquivalent: @""
         atIndex: mItems.Count()];
  [item setTarget: mDelegate];
  [item setRepresentedObject: [[DOMElementWrapper alloc] initWithElement:element]];
  
  mItems.AppendObject(element);

  return NS_OK;
}

NS_IMETHODIMP nsCocoaMenu::RemoveMenuItem(const nsAString& aId)
{
  NS_ENSURE_STATE(mDocument);
  NS_ENSURE_STATE(mMenu);

  nsresult rv;
  nsCOMPtr<nsIDOMElement> element;
  rv = mDocument->GetElementById(aId, getter_AddRefs(element));
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 index = mItems.IndexOf(element);
  if (index == nsTArray<nsIDOMElement*>::NoIndex)
    return NS_ERROR_NOT_AVAILABLE;

  [mMenu removeItemAtIndex: index];
  if (mItems.Count() == 1) {
     // Remove the separator
    [mMenu removeItemAtIndex: 0];
  }

  mItems.RemoveObjectAt(index);

  return NS_OK;
}

NS_IMETHODIMP
nsCocoaMenu::RemoveAllMenuItems()
{
  NS_ENSURE_STATE(mMenu);
  
  PRUint32 menuCount = mItems.Count();
  PRUint32 index;
  for (index=menuCount; index>0; index--) {
    [mMenu removeItemAtIndex: index-1];
    mItems.RemoveObjectAt(index-1);
  }
  
  return NS_OK;
}

NS_IMETHODIMP
nsCocoaMenu::GetItems(nsISimpleEnumerator** _retval)
{
  return NS_OK;
}
