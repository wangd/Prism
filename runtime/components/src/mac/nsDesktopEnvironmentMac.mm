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

#include "DOMElementWrapper.h"
#include "nsCocoaMenu.h"
#include "nsCOMPtr.h"
#include "nsDockTile.h"
#include "nsICategoryManager.h"
#include "nsIDOMDocument.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIDOMElement.h"
#include "nsIDOMEvent.h"
#include "nsIDOMEventTarget.h"
#include "nsIDOMWindow.h"
#include "nsIFile.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsINativeMenu.h"
#include "nsIObserverService.h"
#include "nsIProperties.h"
#include "nsServiceManagerUtils.h"
#include "nsStringAPI.h"

@interface DockMenuDelegate : NSObject
{
  id mOldDelegate;
  nsINativeMenu* mDockMenu;
}

- (id)initWithDockMenu:(nsINativeMenu*)dockMenu;
- (void)addMenuChild:(NSMenu*)menu child:(nsIDOMElement*)child;

@end

@implementation DockMenuDelegate

- (id)initWithDockMenu:(nsINativeMenu*)dockMenu
{
  mDockMenu = dockMenu;
  NS_ADDREF(mDockMenu);
  mOldDelegate = [[NSApplication sharedApplication] delegate];
  return self;
}

- (void)addMenuChild:(NSMenu*)menu child:(nsIDOMElement*)element
{
  nsAutoString label;
  if (NS_SUCCEEDED(element->GetAttribute(NS_LITERAL_STRING("label"), label))) {
    NSMenuItem *menuItem = [[NSMenuItem alloc]
                             initWithTitle:[NSString stringWithCharacters:label.get() length:label.Length()]
                             action:@selector(dockMenuItemSelected:)
                             keyEquivalent:@""];
    nsAutoString tagName;
    element->GetTagName(tagName);
    if (tagName == NS_LITERAL_STRING("MENU")) {
      NSMenu* subMenu = [[[NSMenu alloc] initWithTitle:@""] autorelease];
      [menuItem setSubmenu:subMenu];

      nsCOMPtr<nsIDOMNode> node;
      element->GetFirstChild(getter_AddRefs(node));
      
      while (node) {
        nsCOMPtr<nsIDOMElement> child(do_QueryInterface(node));
        if (!child)
          break;

        [self addMenuChild:subMenu child:child];
        
        child->GetNextSibling(getter_AddRefs(node));
      }
    }
    else if (tagName == NS_LITERAL_STRING("COMMAND")) {
      [menuItem setTarget:self];
      [menuItem setRepresentedObject:[[DOMElementWrapper alloc] initWithElement:element]];
    }
    else {
      // We only handle <command> and <menu>
      return;
    }
    [menu addItem:menuItem];
    [menuItem release];
  }
}

- (NSMenu *)applicationDockMenu:(NSApplication *)sender
{
  NSMenu* menu = [mOldDelegate applicationDockMenu:sender];
  
 [menu addItem:[NSMenuItem separatorItem]];
  
  nsCOMPtr<nsISimpleEnumerator> items;
  if (NS_SUCCEEDED(mDockMenu->GetItems(getter_AddRefs(items)))) {
    PRBool more;
    while (NS_SUCCEEDED(items->HasMoreElements(&more)) && more) {
      nsCOMPtr<nsISupports> supports;
      if (NS_SUCCEEDED(items->GetNext(getter_AddRefs(supports)))) {
        nsCOMPtr<nsIDOMElement> element(do_QueryInterface(supports));
        if (element) {
          [self addMenuChild:menu child:element];
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

NS_IMPL_ISUPPORTS2(nsDesktopEnvironment, nsIDesktopEnvironment, nsIShellService)

nsDesktopEnvironment::nsDesktopEnvironment()
{
}

nsDesktopEnvironment::~nsDesktopEnvironment()
{
}

NS_IMETHODIMP nsDesktopEnvironment::GetAutoStart(PRBool* _retval)
{
  NSString *loginWindowPlistPath = [@"~/Library/Preferences/loginwindow.plist" stringByExpandingTildeInPath];
  NSMutableDictionary *loginWindowPrefsDictionary = [NSMutableDictionary dictionaryWithContentsOfFile:loginWindowPlistPath];
  NSMutableArray *launchItems = [NSMutableArray arrayWithArray:[loginWindowPrefsDictionary valueForKey:@"AutoLaunchedApplicationDictionary"]];
  NSEnumerator *enumerator = [launchItems objectEnumerator];
  id application;

  // search for entry
  *_retval = PR_FALSE;
  while ((application = [enumerator nextObject]))
  {
    if ([[[application valueForKey:@"Path"] lastPathComponent] isEqualToString:[[[NSBundle mainBundle] bundlePath] lastPathComponent]])
    {
      *_retval = PR_TRUE;
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::SetAutoStart(PRBool aAutoStart, PRBool aIconic)
{
  // setup run on login
  NSString *loginWindowPlistPath = [@"~/Library/Preferences/loginwindow.plist" stringByExpandingTildeInPath];
  NSMutableDictionary *loginWindowPrefsDictionary = [NSMutableDictionary dictionaryWithContentsOfFile:loginWindowPlistPath];
  NSMutableArray *launchItems = [NSMutableArray arrayWithArray:[loginWindowPrefsDictionary valueForKey:@"AutoLaunchedApplicationDictionary"]];
  NSEnumerator *enumerator = [launchItems objectEnumerator];
  id application;

  // delete any existing entries
  while ((application = [enumerator nextObject]))
  {
    if ([[[application valueForKey:@"Path"] lastPathComponent] isEqualToString:[[[NSBundle mainBundle] bundlePath] lastPathComponent]])
    {
      [launchItems removeObject:application];
      [loginWindowPrefsDictionary setObject:launchItems forKey:@"AutoLaunchedApplicationDictionary"];
      [loginWindowPrefsDictionary writeToFile:loginWindowPlistPath atomically:YES];
    }
  }

  // add entry if login startup desired
  if (aAutoStart)
  {
    NSString *fullPath = [NSString stringWithFormat: @"%@", [[NSBundle mainBundle] bundlePath]];
    [launchItems addObject: [NSMutableDictionary dictionaryWithObjectsAndKeys:
      fullPath, @"Path",
      [NSNumber numberWithBool: YES], @"Hide", NULL]];
    [loginWindowPrefsDictionary setObject:launchItems forKey:@"AutoLaunchedApplicationDictionary"];
    [loginWindowPrefsDictionary writeToFile:loginWindowPlistPath atomically:YES];
  }
  return NS_OK;
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

NS_IMETHODIMP nsDesktopEnvironment::GetDefaultApplicationForURIScheme(const nsAString& aScheme, nsAString& _retval)
{
  CFURLRef appURL = nil;
  OSStatus err = noErr;
  
  nsAutoString url(aScheme);
  url += NS_LITERAL_STRING(":");
  
  CFStringRef urlString = ::CFStringCreateWithCharacters(NULL, url.get(), url.Length());

  CFURLRef tempURL = ::CFURLCreateWithString(kCFAllocatorDefault,
                                             urlString,
                                             NULL);
  err = ::LSGetApplicationForURL(tempURL, kLSRolesAll, NULL, &appURL);
  ::CFRelease(tempURL);
  ::CFRelease(urlString);
  
  CFStringRef leafName = ::CFURLCopyLastPathComponent(appURL);
  CFRange extension = ::CFStringFind(leafName, CFSTR(".app"), 0);
  if (extension.location == kCFNotFound) {
    // Fail if we haven't found an app bundle
    return NS_ERROR_FAILURE;
  }

  PRUnichar* buffer = new PRUnichar[extension.location+1];
  ::CFStringGetCharacters(leafName, CFRangeMake(0, extension.location), buffer);
  buffer[extension.location] = 0;
  _retval = buffer;
  delete [] buffer;

  return err == noErr ? NS_OK : NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsDesktopEnvironment::GetSystemMenu(nsIDOMWindow* aWindow, nsINativeMenu** _retval)
{
  NS_ENSURE_ARG(aWindow);
  NS_ENSURE_ARG(_retval);

  nsresult rv;
  nsCOMPtr<nsIDOMDocument> document;
  rv = aWindow->GetDocument(getter_AddRefs(document));
  NS_ENSURE_SUCCESS(rv, rv);

  NSMenu* applicationMenu = [[[NSApp mainMenu] itemAtIndex:0] submenu];
  *_retval = new nsCocoaMenu(document, applicationMenu);
  NS_ENSURE_TRUE(*_retval, NS_ERROR_OUT_OF_MEMORY);
  NS_ADDREF(*_retval);

  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::GetMenuBar(nsIDOMWindow* aWindow, nsINativeMenu** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
