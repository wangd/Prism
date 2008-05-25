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

extern "C" {
  extern OSStatus _LSSaveAndRefresh(void);
}

#include "nsDesktopEnvironmentMac.h"

#include "nsCOMPtr.h"
#include "nsDockTile.h"
#include "nsICategoryManager.h"
#include "nsIDOMDocument.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIDOMElement.h"
#include "nsIDOMEvent.h"
#include "nsIDOMEventTarget.h"
#include "nsIFile.h"
#include "nsINativeMenu.h"
#include "nsIObserverService.h"
#include "nsIProperties.h"
#include "nsServiceManagerUtils.h"
#include "nsStringAPI.h"

@interface DOMElementWrapper : NSObject
{
  nsIDOMElement* mElement;
}

- (id)initWithElement:(nsIDOMElement*)element;
- (nsIDOMElement*)element;

@end

@implementation DOMElementWrapper

- (id)initWithElement:(nsIDOMElement*)element
{
  mElement = element;
  NS_ADDREF(mElement);
  return self;
}

- (void)dealloc
{
  NS_RELEASE(mElement);
  [super dealloc];
}

- (nsIDOMElement*)element
{
  return mElement;
}

@end

@interface DockMenuDelegate : NSObject
{
  id mOldDelegate;
  nsINativeMenu* mDockMenu;
}

- (id)initWithDockMenu:(nsINativeMenu*)dockMenu;

@end

@implementation DockMenuDelegate

- (id)initWithDockMenu:(nsINativeMenu*)dockMenu
{
  mDockMenu = dockMenu;
  NS_ADDREF(mDockMenu);
  mOldDelegate = [[NSApplication sharedApplication] delegate];
  return self;
}

- (NSMenu *)applicationDockMenu:(NSApplication *)sender
{
  NSMenu* menu = [mOldDelegate applicationDockMenu:sender];
  
  PRBool first = PR_TRUE;
  
  nsCOMPtr<nsISimpleEnumerator> items;
  if (NS_SUCCEEDED(mDockMenu->GetItems(getter_AddRefs(items)))) {
    PRBool more;
    while (NS_SUCCEEDED(items->HasMoreElements(&more)) && more) {
      nsCOMPtr<nsISupports> supports;
      if (NS_SUCCEEDED(items->GetNext(getter_AddRefs(supports)))) {
        nsCOMPtr<nsIDOMElement> element(do_QueryInterface(supports));
        if (element) {
          nsAutoString label;
          if (NS_SUCCEEDED(element->GetAttribute(NS_LITERAL_STRING("label"), label))) {
            if (first) {
              [menu addItem:[NSMenuItem separatorItem]];
              first = PR_FALSE;
            }
            NSMenuItem *menuItem = [[NSMenuItem alloc]
                                     initWithTitle:[NSString stringWithCharacters:label.get() length:label.Length()]
                                     action:@selector(dockMenuItemSelected:)
                                     keyEquivalent:@""];
            [menuItem setTarget:self];
            [menuItem setRepresentedObject:[[DOMElementWrapper alloc] initWithElement:element]];
            [menu addItem:menuItem];
            [menuItem release];
          }
        }
      }
    }
  }
  
  return menu;
}

- (void)dockMenuItemSelected:(id)sender
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

- (BOOL)respondsToSelector:(SEL)aSelector
{
  BOOL responds = [super respondsToSelector:aSelector];

  if(!responds)
    responds = [mOldDelegate respondsToSelector:aSelector];
         
  return responds;
}

- (void)forwardInvocation:(NSInvocation *)anInvocation
{
  if ([mOldDelegate respondsToSelector:[anInvocation selector]])
    [anInvocation invokeWithTarget:mOldDelegate];
  else
    [super forwardInvocation:anInvocation];
}

- (NSMethodSignature *)methodSignatureForSelector:(SEL)aSelector
{
  if ([[self class] instancesRespondToSelector:aSelector])
    return [[self class] instanceMethodSignatureForSelector:aSelector];
  else if ([mOldDelegate respondsToSelector:aSelector])
    return [mOldDelegate methodSignatureForSelector:aSelector];
  else
    return [super methodSignatureForSelector: aSelector];
}

- (void)dealloc
{
  NS_RELEASE(mDockMenu);
  [super dealloc];
}

@end

NS_IMPL_ISUPPORTS3(nsDesktopEnvironment, nsIDesktopEnvironment, nsIMacDock, nsIShellService)

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

  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDesktopEnvironment::GetApplicationIcon(nsIDOMWindow* aWindow, nsIApplicationIcon** _retval)
{
  nsresult rv;
  if (!mDockTile) {
    mDockTile = new nsDockTile(aWindow);
    NS_ENSURE_TRUE(mDockTile, NS_ERROR_OUT_OF_MEMORY);
    
    // Register our delegate for dock menu customization
    nsCOMPtr<nsINativeMenu> dockMenu;
    rv = mDockTile->GetMenu(getter_AddRefs(dockMenu));
    NS_ENSURE_SUCCESS(rv, rv);
    
    id delegate = [[DockMenuDelegate alloc] initWithDockMenu:dockMenu];
    [[NSApplication sharedApplication] setDelegate:delegate];
  }
  
  *_retval = mDockTile;
  NS_ADDREF(*_retval);
  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::SetZLevel(nsIDOMWindow* aWindow, PRUint16 aLevel)
{
  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::RegisterProtocol(
  const nsAString& aScheme,
  nsIFile* aApplicationFile,
  const nsAString& aArguments)
{
  nsresult rv;
  NSBundle* bundle;
  if (aApplicationFile) {
    nsAutoString applicationPath;
    rv = aApplicationFile->GetPath(applicationPath);
    NS_ENSURE_SUCCESS(rv, rv);

    NSString* path = [NSString stringWithCharacters:applicationPath.get() length:applicationPath.Length()];
    bundle = [NSBundle bundleWithPath:path];
  }
  else {
    bundle = [NSBundle mainBundle];
  }
  
  NSString* scheme = [NSString stringWithCharacters:nsString(aScheme).get() length:aScheme.Length()];
  LSSetDefaultHandlerForURLScheme((CFStringRef) scheme, (CFStringRef) [bundle bundleIdentifier]);
  
  _LSSaveAndRefresh();
  
  return NS_OK;  
}

NS_IMETHODIMP nsDesktopEnvironment::UnregisterProtocol(const nsAString& aScheme)
{
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

NS_IMETHODIMP nsDesktopEnvironment::GetSystemMenu(nsIDOMWindow* aWindow, nsINativeMenu** _retval)
{
  NS_ENSURE_ARG(_retval);
  *_retval = 0;
  return NS_OK;
}
