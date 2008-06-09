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

#include "nsDesktopEnvironmentWin.h"

#include "nsCOMPtr.h"
#include "nsComponentManagerUtils.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIApplicationIcon.h"
#include "nsIBaseWindow.h"
#include "nsICategoryManager.h"
#include "nsIDocShell.h"
#include "nsIDocShellTreeItem.h"
#include "nsIDocShellTreeOwner.h"
#include "nsIDOMDocument.h"
#include "nsIDOMWindow.h"
#include "nsIGenericFactory.h"
#include "nsIInterfaceRequestor.h"
#include "nsILocalFile.h"
#include "nsIProperties.h"
#include "nsIServiceManager.h"
#include "nsIWebNavigation.h"
#include "nsIXULAppInfo.h"
#include "nsIXULWindow.h"
#include "nsNotificationArea.h"
#include "nsServiceManagerUtils.h"
#include "nsSystemMenu.h"

#include <windows.h>
#include <shlobj.h>
#include <shlguid.h>
#include <comutil.h>

#define MAX_BUF 4096

NS_IMPL_THREADSAFE_ISUPPORTS4(nsDesktopEnvironment, nsIDesktopEnvironment,
  nsIDirectoryServiceProvider, nsIObserver, nsIShellService)

nsDesktopEnvironment::nsDesktopEnvironment()
{
}

nsDesktopEnvironment::~nsDesktopEnvironment()
{
}

nsresult nsDesktopEnvironment::Init()
{
  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::GetFile(const char* prop,
    PRBool* persistent, nsIFile** _retval)
{
  nsresult rv;
  if (strcmp(prop, "QuickLaunch") == 0) {
    nsCOMPtr<nsIFile> directory;
    nsCOMPtr<nsIProperties>
      dirSvc(do_GetService("@mozilla.org/file/directory_service;1", &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = dirSvc->Get("AppData",
      NS_GET_IID(nsIFile), getter_AddRefs(directory));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = directory->Append(NS_LITERAL_STRING("Microsoft"));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = directory->Append(NS_LITERAL_STRING("Internet Explorer"));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = directory->Append(NS_LITERAL_STRING("Quick Launch"));
    NS_ENSURE_SUCCESS(rv, rv);

    NS_ADDREF(*_retval = directory);

    if (persistent)
      *persistent = PR_FALSE;

    return NS_OK;
  }
  else {
    return NS_ERROR_NOT_AVAILABLE;
  }
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
  NS_ENSURE_ARG(aLocation);
  NS_ENSURE_ARG(aTarget);

  nsresult rv;
  nsAutoString linkPath;
  rv = aLocation->GetPath(linkPath);
  NS_ENSURE_SUCCESS(rv, rv);

  HRESULT    hres;
  IShellLinkW *psl;
  wchar_t  lpszFullPath[MAX_BUF];
  wchar_t* lpszPathLink = (wchar_t *) nsString(linkPath).get();

  wcscpy(lpszFullPath, lpszPathLink);
  lstrcatW(lpszFullPath, L"\\");
  lstrcatW(lpszFullPath, nsString(aName).get());
  lstrcatW(lpszFullPath, L".lnk");

  CreateDirectoryW(lpszPathLink, NULL);
  CoInitialize(NULL);

  // Get a pointer to the IShellLink interface.
  hres = CoCreateInstance(CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, IID_IShellLinkW, (LPVOID *)&psl);
  if (FAILED(hres))
    return NS_ERROR_FAILURE;

  IPersistFile* ppf;

  // Set the path to the shortcut target, and add the
  // description.
  nsAutoString targetPath;
  rv = aTarget->GetPath(targetPath);
  NS_ENSURE_SUCCESS(rv, rv);

  psl->SetPath(targetPath.get());
  psl->SetDescription(nsString(aDescription).get());

  if(!aWorkingPath.IsEmpty())
      psl->SetWorkingDirectory(nsString(aWorkingPath).get());
  if(!aArguments.IsEmpty())
      psl->SetArguments(nsString(aArguments).get());

  if (aIcon)
  {
    nsAutoString aIconPath;
    rv = aIcon->GetPath(aIconPath);
    NS_ENSURE_SUCCESS(rv, rv);

    psl->SetIconLocation(aIconPath.get(), 0);
  }

  // Query IShellLink for the IPersistFile interface for saving the
  // shortcut in persistent storage.
  hres = psl->QueryInterface(IID_IPersistFile, (LPVOID FAR *)&ppf);
  if(SUCCEEDED(hres))
  {
    // Save the link by calling IPersistFile::Save.
    hres = ppf->Save(lpszFullPath, TRUE);
    ppf->Release();
  }
  psl->Release();

  nsCOMPtr<nsILocalFile>
    shortcutFile(do_CreateInstance("@mozilla.org/file/local;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = shortcutFile->InitWithPath(nsString(lpszFullPath));
  NS_ENSURE_SUCCESS(rv, rv);

  return CallQueryInterface(shortcutFile, _retval);
}

NS_IMETHODIMP nsDesktopEnvironment::GetApplicationIcon(nsIDOMWindow* aWindow, nsIApplicationIcon** _retval)
{
  NS_ENSURE_ARG(aWindow);

  if (!mNotificationArea) {
    mNotificationArea = new nsNotificationArea(aWindow);
    NS_ENSURE_TRUE(mNotificationArea, NS_ERROR_OUT_OF_MEMORY);
  }

  NS_ADDREF(*_retval = mNotificationArea);
  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::SetZLevel(nsIDOMWindow* aWindow,
  PRUint16 aLevel)
{
  if (aLevel != nsIDesktopEnvironment::zLevelTop)
    return NS_ERROR_NOT_IMPLEMENTED;

  nsresult rv;
  HWND hWnd;
  rv = GetHWNDForDOMWindow(aWindow, (void *) &hWnd);
  NS_ENSURE_SUCCESS(rv, rv);

  SetForegroundWindow(hWnd);

  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::GetSystemMenu(nsIDOMWindow* aWindow, nsINativeMenu** _retval)
{
  nsresult rv;
  HWND hWnd;
  rv = GetHWNDForDOMWindow(aWindow, (void *) &hWnd);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMDocument> document;
  rv = aWindow->GetDocument(getter_AddRefs(document));
  NS_ENSURE_SUCCESS(rv, rv);

  return nsSystemMenu::GetSystemMenu(hWnd, document, _retval);
}

NS_IMETHODIMP nsDesktopEnvironment::RegisterProtocol(
  const nsAString& aScheme,
  nsIFile* aApplicationFile,
  const nsAString& aArguments)
{
  nsresult rv;
  nsAutoString appPath;
  if (aApplicationFile) {
    rv = aApplicationFile->GetPath(appPath);
    NS_ENSURE_SUCCESS(rv, rv);
    
    appPath = QuoteCommandLineString(appPath);
    
    appPath += NS_LITERAL_STRING(" ");
    appPath += aArguments;
  }
  else {
    int numArgs;
    LPWSTR* argv = ::CommandLineToArgvW(::GetCommandLineW(), &numArgs);
    
    WCHAR fullPath[4096];
    if (!::GetFullPathNameW(argv[0], 4096, fullPath, NULL)) {
      ::LocalFree(argv);
      return NS_ERROR_FAILURE;
    }
    appPath = QuoteCommandLineString(nsString(fullPath));
    
    for (int i=1; i<numArgs; i++) {
      appPath += NS_LITERAL_STRING(" ");
      
      // Don't include -url parameter
      if (wcscmp(argv[i], L"-url") == 0)
      {
        i++; // Skip -url value as well
        continue;
      }
      
      appPath += QuoteCommandLineString(nsString(argv[i]));
    }
    
    ::LocalFree(argv);
  }
  
  nsCOMPtr<nsIXULAppInfo> appInfo(do_GetService("@mozilla.org/xre/app-info;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCAutoString appName;
  rv = appInfo->GetName(appName);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIProperties> dirSvc(do_GetService("@mozilla.org/file/directory_service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILocalFile> appHelper;
  rv = dirSvc->Get(NS_OS_CURRENT_PROCESS_DIR, NS_GET_IID(nsILocalFile), getter_AddRefs(appHelper));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = appHelper->Append(NS_LITERAL_STRING("regprot.exe"));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAutoString helperPath;
  rv = appHelper->GetPath(helperPath);
  NS_ENSURE_SUCCESS(rv, rv);
  
  helperPath += NS_LITERAL_STRING(" /Protocol ");
  helperPath += aScheme;
  helperPath += NS_LITERAL_STRING(" /ApplicationPath ");
  helperPath += appPath;
  helperPath += NS_LITERAL_STRING(" /ApplicationName ");
  helperPath += NS_ConvertUTF8toUTF16(appName);
  
  STARTUPINFOW si = {sizeof(si), 0};
  PROCESS_INFORMATION pi = {0};

  BOOL ok = ::CreateProcessW(NULL, (LPWSTR) helperPath.get(), NULL, NULL,
                             FALSE, 0, NULL, NULL, &si, &pi);

  if (!ok)
    return NS_ERROR_FAILURE;

  CloseHandle(pi.hProcess);
  CloseHandle(pi.hThread);
  
  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::UnregisterProtocol(const nsAString& aScheme)
{
  nsresult rv;
  nsCOMPtr<nsIProperties> dirSvc(do_GetService("@mozilla.org/file/directory_service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILocalFile> appHelper;
  rv = dirSvc->Get(NS_OS_CURRENT_PROCESS_DIR, NS_GET_IID(nsILocalFile), getter_AddRefs(appHelper));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = appHelper->Append(NS_LITERAL_STRING("regprot.exe"));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAutoString helperPath;
  rv = appHelper->GetPath(helperPath);
  NS_ENSURE_SUCCESS(rv, rv);
  
  helperPath += NS_LITERAL_STRING(" /Protocol ");
  helperPath += aScheme;
  
  helperPath += NS_LITERAL_STRING(" /Unregister");
  
  STARTUPINFOW si = {sizeof(si), 0};
  PROCESS_INFORMATION pi = {0};

  BOOL ok = ::CreateProcessW(NULL, (LPWSTR) helperPath.get(), NULL, NULL,
                             FALSE, 0, NULL, NULL, &si, &pi);

  if (!ok)
    return NS_ERROR_FAILURE;

  CloseHandle(pi.hProcess);
  CloseHandle(pi.hThread);
  
  return NS_OK;
}

// Quote the string if it contains spaces
nsString nsDesktopEnvironment::QuoteCommandLineString(const nsAString& aString)
{
  if (aString.FindChar(' ') == -1)
    return nsString(aString);
    
  nsString quoted = NS_LITERAL_STRING("\"");
  quoted += aString;
  quoted += NS_LITERAL_STRING("\"");
  
  return quoted;
}

// Retrieves the HWND associated with a DOM window
nsresult nsDesktopEnvironment::GetHWNDForDOMWindow(nsIDOMWindow* aWindow, void* hWnd)
{
  NS_ENSURE_ARG(hWnd);

  nsresult rv;
  nsCOMPtr<nsIInterfaceRequestor>
    requestor(do_QueryInterface(aWindow, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIWebNavigation> nav;
  rv = requestor->GetInterface(NS_GET_IID(nsIWebNavigation),
    getter_AddRefs(nav));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDocShellTreeItem> treeItem(do_QueryInterface(nav, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDocShellTreeOwner> treeOwner;
  rv = treeItem->GetTreeOwner(getter_AddRefs(treeOwner));
  NS_ENSURE_SUCCESS(rv, rv);

  requestor = do_QueryInterface(treeOwner, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIXULWindow> xulWindow;
  rv = requestor->GetInterface(NS_GET_IID(nsIXULWindow), getter_AddRefs(xulWindow));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDocShell> docShell;
  rv = xulWindow->GetDocShell(getter_AddRefs(docShell));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIBaseWindow> baseWindow(do_QueryInterface(docShell, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nativeWindow theNativeWindow;
  rv = baseWindow->GetParentNativeWindow( &theNativeWindow );
  NS_ENSURE_SUCCESS(rv, rv);

  *((HWND *) hWnd) = reinterpret_cast<HWND>(theNativeWindow);
  NS_ENSURE_TRUE(hWnd, NS_ERROR_UNEXPECTED);

  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::Observe(nsISupports* aSubject,
    const char* aTopic, const PRUnichar* aData)
{
  nsresult rv;
  if (strcmp(aTopic, "app-startup") == 0)
  {
    nsCOMPtr<nsIDirectoryService> dirservice(do_GetService(
      "@mozilla.org/file/directory_service;1", &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    // Register as a mozilla directory provider.
    rv = dirservice->RegisterProvider(this);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_OK;
}

NS_METHOD nsDesktopEnvironment::OnRegistration(nsIComponentManager *aCompMgr,
    nsIFile *aPath, const char *registryLocation, const char *componentType,
    const nsModuleComponentInfo *info)
{
  nsresult rv = NS_OK;

  // Get service manager
  nsCOMPtr<nsIServiceManager> serviceManager =
    do_QueryInterface((nsISupports*) aCompMgr, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Get category manager
  nsCOMPtr<nsICategoryManager> categoryManager;
  rv = serviceManager->GetServiceByContractID(NS_CATEGORYMANAGER_CONTRACTID,
      NS_GET_IID(nsICategoryManager), getter_AddRefs(categoryManager));
  NS_ENSURE_SUCCESS(rv, rv);

  // Register plugin as an observer for app startup event.
  rv = categoryManager->AddCategoryEntry("app-startup",
    "nsDesktopEnvironment",
    "service," NS_DESKTOPENVIRONMENT_CONTRACTID,
    PR_TRUE,  // persist category
    PR_TRUE,  // replace existing
    nsnull);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_METHOD nsDesktopEnvironment::OnUnregistration(nsIComponentManager *aCompMgr,
    nsIFile *aPath, const char *registryLocation,
    const nsModuleComponentInfo *info)
{
  nsresult rv = NS_OK;

  // Get service manager
  nsCOMPtr<nsIServiceManager> serviceManager =
    do_QueryInterface((nsISupports*) aCompMgr, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Get category manager
  nsCOMPtr<nsICategoryManager> categoryManager;
  rv = serviceManager->GetServiceByContractID(NS_CATEGORYMANAGER_CONTRACTID,
      NS_GET_IID(nsICategoryManager), getter_AddRefs(categoryManager));
  NS_ENSURE_SUCCESS(rv, rv);

  // Unregister observer.
  rv = categoryManager->DeleteCategoryEntry("app-startup",
      "nsDesktopEnvironment", PR_TRUE);  // persist
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}
