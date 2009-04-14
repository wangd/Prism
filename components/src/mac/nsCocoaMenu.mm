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

#include "DOMEventListenerWrapper.h"
#include "nsIDOMDocument.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIDOMEvent.h"
#include "nsIDOMEventListener.h"
#include "nsIDOMWindow.h"
#include "nsIDOMWindowInternal.h"
#include "nsIWindowMediator.h"
#include "nsMemory.h"
#include "nsServiceManagerUtils.h"
#include "nsStringAPI.h"
#include "nsTArray.h"

@interface NativeMenuDelegate : NSObject
{
  nsINativeMenu* mMenu;
  nsIDOMDocument* mDocument;
}

- (id)initWithMenu:(nsINativeMenu*)menu document:(nsIDOMDocument*)document;

@end

@implementation NativeMenuDelegate

- (id)initWithMenu:(nsINativeMenu*)menu document:(nsIDOMDocument*)document
{
  mMenu = menu;
  NS_ADDREF(mMenu);
  mDocument = document;
  NS_ADDREF(mDocument);
  return self;
}

- (void)menuItemSelected:(id)sender
{
 nsCOMPtr<nsIWindowMediator> windowMediator(do_GetService(NS_WINDOWMEDIATOR_CONTRACTID));
  if (!windowMediator)
    return;
    
  nsCOMPtr<nsIDOMWindowInternal> windowInternal;
  if (NS_FAILED(windowMediator->GetMostRecentWindow(NS_LITERAL_STRING("navigator:browser").get(), getter_AddRefs(windowInternal))))
    return;
    
  nsCOMPtr<nsIDOMWindow> window(do_QueryInterface(windowInternal));
  if (!window)
    return;
    
  nsCOMPtr<nsIDOMDocument> document;
  if (NS_FAILED(window->GetDocument(getter_AddRefs(document))))
    return;

  nsCOMPtr<nsIDOMEventListener> listener = [[sender representedObject] eventListener];
    
  nsCOMPtr<nsIDOMDocumentEvent> documentEvent(do_QueryInterface(document));
  if (!documentEvent)
    return;

  nsCOMPtr<nsIDOMEvent> event;
  if (NS_FAILED(documentEvent->CreateEvent(NS_LITERAL_STRING("Events"), getter_AddRefs(event))))
    return;

  if (NS_FAILED(event->InitEvent(NS_LITERAL_STRING("DOMActivate"), PR_TRUE, PR_TRUE)))
    return;

  listener->HandleEvent(event);
}

- (void)dealloc
{
  NS_RELEASE(mMenu);
  NS_RELEASE(mDocument);
  [super dealloc];
}

@end

NS_IMPL_THREADSAFE_ISUPPORTS2(nsCocoaMenu, nsINativeMenu, nsISecurityCheckedComponent)

nsCocoaMenu::nsCocoaMenu(nsIDOMDocument* document, NSMenu* menu)
{
  mDocument = document;
  mMenu = menu;
  mDelegate = [[NativeMenuDelegate alloc] initWithMenu: this document:mDocument];
}

nsCocoaMenu::~nsCocoaMenu()
{
  RemoveAllMenuItems();
  [mDelegate release];
}

NS_IMETHODIMP nsCocoaMenu::GetHandle(void** _retval)
{
  NS_ENSURE_ARG(*_retval);
  
  *_retval = mMenu;
  
  return NS_OK;
}

NS_IMETHODIMP nsCocoaMenu::AddMenuItem(const nsAString& aId, const nsAString& aLabel, nsIDOMEventListener* aListener)
{
  NS_ENSURE_STATE(mMenu);

  if (mIds.Length() == 0) {
    // Insert separator after first item
    // [mMenu insertItem: [NSMenuItem separatorItem] atIndex: 0];
  }
  
  NSMenuItem* item = [mMenu insertItemWithTitle: [NSString stringWithCharacters:nsString(aLabel).get() length:aLabel.Length()]
    action: @selector (menuItemSelected:)
    keyEquivalent: @""
    atIndex: mIds.Length()];
  [item setTarget: mDelegate];
  [item setRepresentedObject: [[DOMEventListenerWrapper alloc] initWithEventListener:aListener]];
  
  NS_ADDREF(aListener);
  
  mIds.AppendElement(aId);

  return NS_OK;
}

NS_IMETHODIMP nsCocoaMenu::AddSubmenu(const nsAString& aId, const nsAString& aLabel, nsINativeMenu** _retval)
{
  NS_ENSURE_STATE(mMenu);

  if (mIds.Length() == 0) {
    // Insert separator after first item
    //[mMenu insertItem: [NSMenuItem separatorItem] atIndex: 0];
  }
  
  NSMenuItem *menuItem = [mMenu insertItemWithTitle:[NSString stringWithCharacters:nsString(aLabel).get() length:aLabel.Length()]
    action: nil
    keyEquivalent:@""
    atIndex: mIds.Length()];

  NSMenu* submenu = [[[NSMenu alloc] initWithTitle:@""] autorelease];
  [menuItem setSubmenu:submenu];

  *_retval = new nsCocoaMenu(mDocument, submenu);
  NS_ENSURE_TRUE(*_retval, NS_ERROR_OUT_OF_MEMORY);
  
  NS_ADDREF(*_retval);
  
  mIds.AppendElement(aId);
  mSubmenus.AppendObject(*_retval);
  
  return NS_OK;
}

NS_IMETHODIMP nsCocoaMenu::RemoveMenuItem(const nsAString& aId)
{
  NS_ENSURE_STATE(mMenu);

  PRUint32 index = mIds.IndexOf(aId);
  if (index == nsTArray<nsString>::NoIndex)
    return NS_ERROR_NOT_AVAILABLE;

  NSMenuItem* item = [mMenu itemAtIndex:index];
  if (!item)
    return NS_ERROR_NOT_AVAILABLE;
    
  nsIDOMEventListener* listener = [[item representedObject] eventListener];
  if (listener) {
    NS_RELEASE(listener);
  }

  [mMenu removeItemAtIndex: index];
  if (mIds.Length() == 1) {
     // Remove the separator
    // [mMenu removeItemAtIndex: 0];
  }

  mIds.RemoveElementAt(index);

  return NS_OK;
}

NS_IMETHODIMP
nsCocoaMenu::RemoveAllMenuItems()
{
  NS_ENSURE_STATE(mMenu);
  
  PRUint32 menuCount = mIds.Length();
  PRUint32 index;
  for (index=menuCount-1; index>0; index--) {
    NSMenuItem* item = [mMenu itemAtIndex:index];
    if (!item)
      return NS_ERROR_UNEXPECTED;
      
    nsIDOMEventListener* listener = [[item representedObject] eventListener];
    if (listener) {
      NS_RELEASE(listener);
    }

    [mMenu removeItemAtIndex: index];
    mIds.RemoveElementAt(index);
  }
  
  return NS_OK;
}

NS_IMETHODIMP
nsCocoaMenu::GetItems(nsISimpleEnumerator** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

static char* cloneAllAccess()
{
  static const char allAccess[] = "AllAccess";
  return (char*)nsMemory::Clone(allAccess, sizeof(allAccess));
}

static char* cloneNoAccess()
{
  static const char noAccess[] = "NoAccess";
  return (char*)nsMemory::Clone(noAccess, sizeof(noAccess));
}

NS_IMETHODIMP nsCocoaMenu::CanCreateWrapper(const nsIID* iid, char **_retval) {
    *_retval = cloneAllAccess();
    return NS_OK;
}

NS_IMETHODIMP nsCocoaMenu::CanCallMethod(const nsIID *iid, const PRUnichar *methodName, char **_retval) {
    *_retval = cloneAllAccess();
    return NS_OK;
}

NS_IMETHODIMP nsCocoaMenu::CanGetProperty(const nsIID *iid, const PRUnichar *propertyName, char **_retval) {
    *_retval = cloneAllAccess();
    return NS_OK;
}

NS_IMETHODIMP nsCocoaMenu::CanSetProperty(const nsIID *iid, const PRUnichar *propertyName, char **_retval) {
  if (iid->Equals(NS_GET_IID(nsINativeMenu))) {
    *_retval = cloneAllAccess();
  }
  else {
    *_retval = cloneNoAccess();
  }
  return NS_OK;
}
