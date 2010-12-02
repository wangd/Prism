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
#include "nsDOMMenuBar.h"
#include "nsIApplicationIcon.h"
#include "nsIBaseWindow.h"
#include "nsICategoryManager.h"
#include "nsIDocShell.h"
#include "nsIDocShellTreeItem.h"
#include "nsIDocShellTreeOwner.h"
#include "nsIDOMDocument.h"
#include "nsIDOMWindow.h"
#include "nsIDOMElement.h"
#include "nsIDOMXULElement.h"
#include "nsIGenericFactory.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsILocalFile.h"
#include "nsIProperties.h"
#include "nsIServiceManager.h"
#include "nsIWebNavigation.h"
#include "nsIXULAppInfo.h"
#include "nsIXULWindow.h"
#include "nsNotificationArea.h"
#include "nsServiceManagerUtils.h"
#include "nsSystemMenu.h"
#include "nsUnicharUtils.h"

#include <windows.h>
#include <shlobj.h>
#include <shlguid.h>
#include <comutil.h>

#include "nsIWindowsRegKey.h"

#define MAX_BUF 4096

NS_IMPL_THREADSAFE_ISUPPORTS4(nsDesktopEnvironment, nsIDesktopEnvironment,
  nsIDirectoryServiceProvider, nsIObserver, nsIWebProtocolService)

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

NS_IMETHODIMP nsDesktopEnvironment::GetAutoStart(PRBool* _retval)
{
  NS_ENSURE_ARG(_retval);

  nsresult rv;
  nsCOMPtr<nsIWindowsRegKey> regKey(do_CreateInstance("@mozilla.org/windows-registry-key;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString appName;
  rv = GetAppName(appName);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString keyPath = NS_LITERAL_STRING("Software\\Microsoft\\Windows\\CurrentVersion\\Run\\");
  keyPath += appName;

  rv = regKey->Open(nsIWindowsRegKey::ROOT_KEY_LOCAL_MACHINE, keyPath, nsIWindowsRegKey::ACCESS_READ);
  if (NS_FAILED(rv)) {
    *_retval = PR_FALSE;
  }
  else {
    *_retval = PR_TRUE;
  }

  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::SetAutoStart(PRBool aAutoStart, PRBool aIconic)
{
  nsresult rv;
  nsAutoString params;
  params = NS_LITERAL_STRING("/AutoStart ");

  nsAutoString appName;
  rv = GetAppName(appName);
  params += appName;

  if (aAutoStart) {
    nsAutoString commandLine;
    rv = GetAppPath(commandLine);
    NS_ENSURE_SUCCESS(rv, rv);
    
    if (aIconic) {
      commandLine += NS_LITERAL_STRING(" -iconic");
    }

    params += NS_LITERAL_STRING(" /ApplicationPath ");
    params += commandLine;
  }

  rv = RunHelperApp(params);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::HideDirectory(const nsAString& aPath)
{
	char *path = ToNewUTF8String(aPath);
	int res = SetFileAttributes(path, FILE_ATTRIBUTE_HIDDEN);
	NS_Free(path);
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

NS_IMETHODIMP nsDesktopEnvironment::GetMenuBar(nsIDOMWindow* aWindow, nsINativeMenu** _retval)
{
  NS_ENSURE_ARG(aWindow);

  *_retval = new nsDOMMenuBar(aWindow);
  NS_ENSURE_TRUE(*_retval, NS_ERROR_OUT_OF_MEMORY);

  NS_ADDREF(*_retval);
  return NS_OK;
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
    rv = GetAppPath(appPath);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  nsAutoString appName;
  rv = GetAppName(appName);
  NS_ENSURE_SUCCESS(rv, rv);
 
 
  nsAutoString iconPath;
  rv = GetIconPath(iconPath);
  NS_ENSURE_SUCCESS(rv, rv);
   
  nsAutoString params;
  params += NS_LITERAL_STRING(" /Protocol ");
  params += aScheme;
  params += NS_LITERAL_STRING(" /ApplicationPath ");
  params += appPath;
  params += NS_LITERAL_STRING(" /DefaultIcon ");
  params += iconPath;

  rv = RunHelperApp(params);
  NS_ENSURE_SUCCESS(rv, rv);
 
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

nsresult nsDesktopEnvironment::IsRegisteredProtocolHandler(const nsAString& aScheme, PRBool* _retval)
{
  nsresult rv;
  nsCOMPtr<nsIWindowsRegKey> regKey(do_CreateInstance("@mozilla.org/windows-registry-key;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAutoString keyPath = NS_LITERAL_STRING("SOFTWARE\\Classes\\");
  keyPath += aScheme;
  keyPath += NS_LITERAL_STRING("\\DefaultIcon");
    
  rv = regKey->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER, keyPath, nsIWindowsRegKey::ACCESS_READ);
  if (NS_FAILED(rv)) {
    // Can't access the key so assume we are not the handler
    *_retval = PR_FALSE;
  }
  else {
    nsAutoString registryPath;
    rv = regKey->ReadStringValue(EmptyString(), registryPath);
    NS_ENSURE_SUCCESS(rv, rv);

    nsAutoString iconPath;
    rv = GetIconPath(iconPath);
    NS_ENSURE_SUCCESS(rv, rv);
    
    *_retval = (registryPath == iconPath);
  }
  
  return NS_OK;
}

nsresult nsDesktopEnvironment::GetAppName(nsAString& _retval)
{
  nsresult rv;
  nsCOMPtr<nsIXULAppInfo> appInfo(do_GetService("@mozilla.org/xre/app-info;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCAutoString appName;
  rv = appInfo->GetName(appName);
  NS_ENSURE_SUCCESS(rv, rv);

  _retval = NS_ConvertUTF8toUTF16(appName);

  return NS_OK;
} 

// Return the full command-line for the current app
nsresult nsDesktopEnvironment::GetAppPath(nsAString& _retval)
{
  nsAutoString appPath;
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

  _retval = appPath;
  return NS_OK;
}

// Get the path to the default app icon
// We assume there is only one icon in the directory
nsresult nsDesktopEnvironment::GetIconPath(nsAString& _retval)
{
  nsresult rv;
  nsCOMPtr<nsIProperties> dirSvc(do_GetService("@mozilla.org/file/directory_service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISimpleEnumerator> dirs;
  rv = dirSvc->Get("AChromDL", NS_GET_IID(nsISimpleEnumerator), getter_AddRefs(dirs));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsISupports> supports;
  rv = dirs->GetNext(getter_AddRefs(supports));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIFile> iconDir(do_QueryInterface(supports, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = iconDir->Append(NS_LITERAL_STRING("icons"));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = iconDir->Append(NS_LITERAL_STRING("default"));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = iconDir->GetDirectoryEntries(getter_AddRefs(dirs));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = dirs->GetNext(getter_AddRefs(supports));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIFile> iconFile(do_QueryInterface(supports, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAutoString iconPath;
  rv = iconFile->GetPath(_retval);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

// Quote the string if it contains spaces
nsString nsDesktopEnvironment::QuoteCommandLineString(const nsAString& aString)
{
  // Don't quote command line options
  if (aString.FindChar('-') == 0)
    return nsString(aString);
    
  nsString quoted = NS_LITERAL_STRING("\"");
  quoted += aString;
  quoted += NS_LITERAL_STRING("\"");
  
  return quoted;
}

// Run the NSIS helper app with the specified parameters
nsresult nsDesktopEnvironment::RunHelperApp(const nsAString& aParams)
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

  helperPath += NS_LITERAL_STRING(" ");
  helperPath += aParams;
 
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
