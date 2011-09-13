/* ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is MinimizeToTray.
 *
 * The Initial Developer of the Original Code are
 * Mark Yen and Brad Peterson.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Yen <mook.moz+cvs.mozilla.org@gmail.com>, Original author
 *   Brad Peterson <b_peterson@yahoo.com>, Original author
 *   Daniel Glazman <daniel.glazman@disruptive-innovations.com>
 *   Matthew Gertner <matthew.gertner@gmail.com>
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

#include "nsNotificationArea.h"
#include "imgIContainer.h"
#include "imgITools.h"
#include "nsArrayEnumerator.h"
#include "nsAutoPtr.h"
#include "nsComponentManagerUtils.h"
#include "nsCOMArray.h"
#include "nsDesktopEnvironmentWin.h"
#include "nsMemory.h"
#include "nsIBufferedStreams.h"
#include "nsIChannel.h"
#include "nsIDOMDocument.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIDOMElement.h"
#include "nsIDOMEvent.h"
#include "nsIDOMEventListener.h"
#include "nsIDOMEventTarget.h"
#include "nsIDOMWindow.h"
#include "nsIInterfaceRequestor.h"
#include "nsINativeIcon.h"
#include "nsIIOService.h"
#include "nsIPrefBranch.h"
#include "nsIPrefService.h"
#include "nsIPrivateDOMEvent.h"
#include "nsIURI.h"
#include "nsIXULWindow.h"
#include "nsNativeMenu.h"
#include "nsServiceManagerUtils.h"
#include "nsStringAPI.h"

#pragma comment(lib, "shell32.lib")

const TCHAR* nsNotificationArea::S_PROPINST =
  TEXT("_NotificationArea_INST");
const TCHAR* nsNotificationArea::S_PROPPROC =
  TEXT("_NotificationArea_PROC");
const TCHAR* nsNotificationArea::S_PROPBEHAVIOR =
  TEXT("_NotificationArea_BEHAVIOR");

ATOM nsNotificationArea::s_wndClass = NULL;

#define MK_ERROR_OFFSET       (0xE0000000 + (__LINE__ * 0x10000))

#define MK_ENSURE_NATIVE(res)                               \
  PR_BEGIN_MACRO                                            \
    NS_ENSURE_TRUE(0 != res || 0 == ::GetLastError(),       \
      ::GetLastError() + MK_ERROR_OFFSET);                  \
  PR_END_MACRO

// this can be WM_USER + anything
#define WM_TRAYICON         (WM_USER + 0x17b6)
#define MENU_ITEM_BASE_ID   1000

NS_IMPL_ISUPPORTS3(nsNotificationArea, nsIApplicationIcon, nsINativeMenu, nsISecurityCheckedComponent)

nsNotificationArea::nsNotificationArea(nsIDOMWindow* aWindow) : mMenu(NULL)
{
  memset(&mIconData, 0, sizeof(NOTIFYICONDATAW));
  mWindow = aWindow;

  nsCOMPtr<nsIPrefService> prefService(do_GetService("@mozilla.org/preferences-service;1"));
  if (prefService) {
    prefService->GetBranch("notificationarea.", getter_AddRefs(mPrefs));
  }
}

nsNotificationArea::~nsNotificationArea()
{
  BOOL windowClassUnregistered = ::UnregisterClass(
    (LPCTSTR)nsNotificationArea::s_wndClass,
    ::GetModuleHandle(NULL));
  if (windowClassUnregistered)
    nsNotificationArea::s_wndClass = NULL;
}

NS_IMETHODIMP
nsNotificationArea::Show()
{
  nsresult rv;

  if (mImageSpec.IsEmpty())
    // It would be great to use the window's icon automatically here.
    // At worst we could do this using the native Win32 API or grovel through the icons/default directory.
    return NS_ERROR_NOT_INITIALIZED;

  nsCOMPtr<nsIIOService>
    ioService(do_GetService("@mozilla.org/network/io-service;1", &rv));
  nsCOMPtr<nsIURI> imageURI;
  rv = ioService->NewURI(NS_ConvertUTF16toUTF8(mImageSpec), nsnull, nsnull, getter_AddRefs(imageURI));
  NS_ENSURE_SUCCESS(rv, rv);

  if (mIconData.cbSize)
  {
    // Free the existing icon
    ::DestroyIcon(mIconData.hIcon);

    HICON hicon;
    rv = GetIconForURI(imageURI, hicon);
    NS_ENSURE_SUCCESS(rv, rv);

    mIconData.uFlags = NIF_ICON;
    mIconData.hIcon = hicon;
    MK_ENSURE_NATIVE(Shell_NotifyIconW(NIM_MODIFY, &mIconData));

    return NS_OK;
  }

  rv = AddTrayIcon(imageURI);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::Hide()
{
  if (!mIconData.cbSize)
    // can't find the icon data
    return NS_ERROR_NOT_AVAILABLE;

  if (mIconData.hWnd) {
    ::DestroyWindow(mIconData.hWnd);
  }

  ::DestroyIcon(mIconData.hIcon);

  Shell_NotifyIconW(NIM_DELETE, &mIconData);

  memset(&mIconData, 0, sizeof(NOTIFYICONDATAW));

  return NS_OK;
}

nsresult
nsNotificationArea::AddTrayIcon(nsIURI* iconURI)
{
  nsresult rv;

  mIconData.cbSize = sizeof(NOTIFYICONDATAW);
  mIconData.uCallbackMessage = WM_TRAYICON;
  mIconData.uID = 1;
  mIconData.uFlags = NIF_MESSAGE | NIF_ICON;

  HICON hicon = NULL;
  if (iconURI)
  {
    rv = GetIconForURI(iconURI, hicon);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  if (!hicon)
    return NS_ERROR_FAILURE;

  mIconData.hIcon = hicon;

  HWND listenerWindow;
  rv = CreateListenerWindow(&listenerWindow);
  NS_ENSURE_SUCCESS(rv, rv);

  // add the icon
  mIconData.hWnd = listenerWindow;
  MK_ENSURE_NATIVE(Shell_NotifyIconW(NIM_ADD, &mIconData));

  return NS_OK;
}


NS_IMETHODIMP
nsNotificationArea::SetTitle(const nsAString& aTitle)
{
  nsresult rv;
  mTitle = aTitle;

  if (!mIconData.cbSize)
    // We'll set the title later when we display the tray icon.
    return NS_OK;

  mIconData.uFlags = NIF_TIP;

  rv = CopyStringWithMaxLength(aTitle, mIconData.szTip, 128);
  NS_ENSURE_SUCCESS(rv, rv);

  MK_ENSURE_NATIVE(Shell_NotifyIconW(NIM_MODIFY, &mIconData));

  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::GetTitle(nsAString& aTitle)
{
  aTitle = mTitle;
  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::GetMenu(nsINativeMenu** _retval)
{
  return QueryInterface(NS_GET_IID(nsINativeMenu), (void**) _retval);
}

NS_IMETHODIMP
nsNotificationArea::SetImageSpec(const nsAString& aImageSpec)
{
  nsresult rv;
  mImageSpec = aImageSpec;
  if (mIconData.cbSize) {
    rv = Show();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::GetImageSpec(nsAString& aImageSpec)
{
  aImageSpec = mImageSpec;
  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::SetBadgeText(const nsAString& aBadgeText)
{
  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::GetBadgeText(nsAString& aBadgeText)
{
  return NS_OK;
}

NS_IMETHODIMP nsNotificationArea::GetHandle(void** _retval)
{
  NS_ENSURE_STATE(mMenu);

  return mMenu->GetHandle(_retval);
}

NS_IMETHODIMP
nsNotificationArea::AddMenuItem(const nsAString& aId, const nsAString& aLabel, nsIDOMEventListener* aListener)
{
  if (!mMenu) {
    HMENU hMenu = ::CreatePopupMenu();
    mMenu = new nsNativeMenu(hMenu);
    NS_ENSURE_TRUE(mMenu, NS_ERROR_OUT_OF_MEMORY);
  }

  return mMenu->AddMenuItem(aId, aLabel, aListener);
}

nsresult nsNotificationArea::AddSubmenu(const nsAString& aId, const nsAString& aLabel, nsINativeMenu** _retval)
{
  NS_ENSURE_STATE(mMenu);

  return mMenu->AddSubmenu(aId, aLabel, _retval);
}

NS_IMETHODIMP
nsNotificationArea::RemoveMenuItem(const nsAString& aId)
{
  NS_ENSURE_STATE(mMenu);

  return mMenu->RemoveMenuItem(aId);
}

NS_IMETHODIMP
nsNotificationArea::RemoveAllMenuItems()
{
  NS_ENSURE_STATE(mMenu);

  return mMenu->RemoveAllMenuItems();
}

NS_IMETHODIMP
nsNotificationArea::GetItems(nsISimpleEnumerator** _retval)
{
  NS_ENSURE_STATE(mMenu);

  return mMenu->GetItems(_retval);
}

NS_IMETHODIMP
nsNotificationArea::GetBehavior(PRUint32* aBehavior)
{
  NS_ENSURE_STATE(mWindow);

  nsresult rv;
  HWND hwnd;
  rv = nsDesktopEnvironment::GetHWNDForDOMWindow(mWindow, (void *) &hwnd);
  NS_ENSURE_SUCCESS(rv, rv);

  *aBehavior = (PRUint32) GetProp(hwnd, S_PROPBEHAVIOR);

  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::SetBehavior(PRUint32 aBehavior)
{
  NS_ENSURE_STATE(mWindow);

  nsresult rv;
  HWND hwnd;
  rv = nsDesktopEnvironment::GetHWNDForDOMWindow(mWindow, (void *) &hwnd);
  NS_ENSURE_SUCCESS(rv, rv);

  if (aBehavior) {
    if (!GetProp(hwnd, S_PROPBEHAVIOR)) {
      // Window isn't hooked yet
      WNDPROC oldProc = (WNDPROC) ::SetWindowLong(hwnd, GWL_WNDPROC, (DWORD) WindowProc);
      SetProp(hwnd, S_PROPPROC, oldProc);
      SetProp(hwnd, S_PROPINST, mWindow);
    }
  }
  else {
    // Unhook the window since we don't have any behavior anymore
    if (GetProp(hwnd, S_PROPBEHAVIOR)) {
      WNDPROC oldProc = (WNDPROC) GetProp(hwnd, S_PROPPROC);
      ::SetWindowLong(hwnd, GWL_WNDPROC, (DWORD) oldProc);
    }
  }

  SetProp(hwnd, S_PROPBEHAVIOR, (HANDLE) aBehavior);

  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::Minimize()
{
  NS_ENSURE_STATE(mWindow);

  nsresult rv;
  rv = DispatchEvent(mWindow, nsnull, NS_LITERAL_STRING("minimizing"), PR_TRUE, nsnull);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::ShowNotification(const nsAString& aTitle,
                                   const nsAString& aText,
                                   PRUint32 aTimeout,
                                   PRBool aIsClickable,
                                   nsIObserver* aAlertListener)
{
  NS_ENSURE_STATE(mIconData.cbSize);

  nsresult rv;
  mIconData.uFlags = NIF_INFO;
  mIconData.uTimeout = aTimeout;
  rv = CopyStringWithMaxLength(aTitle, mIconData.szInfoTitle, 64);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = CopyStringWithMaxLength(aText, mIconData.szInfo, 256);
  NS_ENSURE_SUCCESS(rv, rv);

  MK_ENSURE_NATIVE(Shell_NotifyIconW(NIM_MODIFY, &mIconData));

  return NS_OK;
}

nsresult
nsNotificationArea::CopyStringWithMaxLength(const nsAString& aSource, wchar_t* aDest, PRUint32 aMaxLength)
{
  PRUint32 length = aSource.Length();
  if (length > aMaxLength-1)
    length = aMaxLength-1;

  wcsncpy(aDest, nsString(aSource).get(), length);
  aDest[length] = 0;

  return NS_OK;
}

nsresult
nsNotificationArea::GetIconForURI(nsIURI* iconURI, HICON& result)
{
  nsresult rv;

  // get a channel to read the data from
  nsCOMPtr<nsIIOService>
    ioService(do_GetService("@mozilla.org/network/io-service;1", &rv));
  nsCOMPtr<nsIChannel> channel;
  rv = ioService->NewChannelFromURI(iconURI, getter_AddRefs(channel));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIInputStream> inputStream;
  rv = channel->Open(getter_AddRefs(inputStream));
  NS_ENSURE_SUCCESS(rv, rv);

  // get the source MIME type
  nsCAutoString sourceMimeType;
  rv = channel->GetContentType(sourceMimeType);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIBufferedInputStream>
      bufferedStream(do_CreateInstance("@mozilla.org/network/buffered-input-stream;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = bufferedStream->Init(inputStream, 1024);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<imgITools> imageTools(do_CreateInstance("@mozilla.org/image/tools;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<imgIContainer> container;
  rv = imageTools->DecodeImageData(bufferedStream, sourceMimeType,
    getter_AddRefs(container));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIInputStream> encodedStream;
  rv = imageTools->EncodeScaledImage(container,
    NS_LITERAL_CSTRING("image/vnd.microsoft.icon"),
    16, 16, getter_AddRefs(encodedStream));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsINativeIcon> nativeIcon(do_QueryInterface(encodedStream, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  return nativeIcon->GetHandle((void **) &result);
}

nsresult
nsNotificationArea::GetElementById(const nsAString& aId, nsIDOMElement** _retval)
{
  NS_ENSURE_STATE(mWindow);

  nsresult rv;
  nsCOMPtr<nsIDOMDocument> document;
  rv = mWindow->GetDocument(getter_AddRefs(document));
  NS_ENSURE_SUCCESS(rv, rv);

  return document->GetElementById(aId, _retval);
}

nsresult
nsNotificationArea::GetIconForWnd(HWND hwnd, HICON& result)
{
  result = (HICON)::SendMessage(hwnd, WM_GETICON, ICON_SMALL, NULL);
  if (!result) {
    // can't find icon; try GetClassLong
    result = (HICON)::GetClassLongPtr(hwnd, GCLP_HICONSM);
  }
  if (!result) {
    // still no icon - use generic windows icon
    result = ::LoadIcon(NULL, IDI_WINLOGO);
  }
  if (!result)
    return NS_ERROR_FAILURE;
  return NS_OK;
}

nsresult
nsNotificationArea::CreateEvent(nsIDOMWindow* aDOMWindow, const nsAString& aType, PRBool canBubble, nsIDOMEvent** _retval)
{
  NS_ENSURE_ARG(aDOMWindow);

  nsresult rv;
  nsCOMPtr<nsIDOMDocument> document;
  rv = aDOMWindow->GetDocument(getter_AddRefs(document));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMDocumentEvent> documentEvent(do_QueryInterface(document, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMEvent> event;
  rv = documentEvent->CreateEvent(NS_LITERAL_STRING("Events"), getter_AddRefs(event));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = event->InitEvent(aType, canBubble, PR_TRUE);
  NS_ENSURE_SUCCESS(rv, rv);

  // Need to make event trusted so content can cause it to be dispatched (e.g. minimizing the window via the API)
  nsCOMPtr<nsIPrivateDOMEvent> privateEvent(do_QueryInterface(event, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = privateEvent->SetTrusted(PR_TRUE);
  NS_ENSURE_SUCCESS(rv, rv);

  *_retval = event;
  NS_ADDREF(*_retval);

  return NS_OK;
}

nsresult
nsNotificationArea::DispatchEvent(
  nsIDOMWindow* aDOMWindow,
  nsIDOMEventTarget* aEventTarget,
  const nsAString& aType,
  PRBool canBubble,
  PRBool* aPreventDefault)
{
  nsresult rv;
  nsCOMPtr<nsIDOMEventTarget> eventTarget;
  if (aEventTarget) {
    eventTarget = aEventTarget;
  }
  else {
    eventTarget = do_QueryInterface(aDOMWindow, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  nsCOMPtr<nsIDOMEvent> event;
  rv = CreateEvent(aDOMWindow, aType, canBubble, getter_AddRefs(event));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool ret;
  rv = eventTarget->DispatchEvent(event, &ret);
  NS_ENSURE_SUCCESS(rv, rv);

  if (aPreventDefault)
    *aPreventDefault = !ret;

  return NS_OK;
}

nsresult
nsNotificationArea::CreateListenerWindow(
  HWND* listenerWindow
)
{
  ::SetLastError(0);
  HINSTANCE hInst = ::GetModuleHandle(NULL);
  MK_ENSURE_NATIVE(hInst);

  if (!nsNotificationArea::s_wndClass) {
    WNDCLASS wndClassDef;
    wndClassDef.style          = CS_NOCLOSE | CS_GLOBALCLASS;
    wndClassDef.lpfnWndProc    = nsNotificationArea::ListenerWindowProc;
    wndClassDef.cbClsExtra     = 0;
    wndClassDef.cbWndExtra     = 0;
    wndClassDef.hInstance      = hInst;
    wndClassDef.hIcon          = NULL;
    wndClassDef.hCursor        = NULL;
    wndClassDef.hbrBackground  = NULL;
    wndClassDef.lpszMenuName   = NULL;
    wndClassDef.lpszClassName  = TEXT("nsNotificationArea:WindowClass");

    nsNotificationArea::s_wndClass = ::RegisterClass(&wndClassDef);
    MK_ENSURE_NATIVE(nsNotificationArea::s_wndClass);
  }

  *listenerWindow =
    ::CreateWindow(
    (LPCTSTR)nsNotificationArea::s_wndClass,                //class
    TEXT("nsNotificationArea:Window"), //caption
    WS_MINIMIZE,                          //style
    CW_USEDEFAULT ,                       //x
    CW_USEDEFAULT ,                       //y
    CW_USEDEFAULT,                        //width
    CW_USEDEFAULT,                        //heigh
    ::GetDesktopWindow(),                 //paren
    NULL,                                 //menu
    hInst,                                //hIns
    NULL);                                //param

  if (!*listenerWindow) {
    if (::UnregisterClass((LPCTSTR)nsNotificationArea::s_wndClass, hInst))
      nsNotificationArea::s_wndClass = NULL;
    MK_ENSURE_NATIVE(*listenerWindow);
  }

  MK_ENSURE_NATIVE(::SetProp(*listenerWindow, S_PROPINST, (HANDLE) this));

  return NS_OK;
}

LRESULT CALLBACK
nsNotificationArea::ListenerWindowProc(HWND hwnd,
                               UINT uMsg,
                               WPARAM wParam,
                               LPARAM lParam)
{
  nsRefPtr<nsNotificationArea> notificationArea;
  notificationArea = (nsNotificationArea *)  GetProp(hwnd, S_PROPINST);

  if (!notificationArea)
    return TRUE;

  HMENU hMenu;
  if (notificationArea->mMenu) {
    notificationArea->mMenu->GetHandle((void **) &hMenu);
  }
  else {
    hMenu = NULL;
  }

  switch(uMsg) {
    case WM_TRAYICON:
      break;
    case WM_CREATE:
      return FALSE;
    case WM_NCCREATE:
      return TRUE;
    case WM_COMMAND:
      if (hMenu && (HIWORD(wParam) == 0)) {
        MENUITEMINFO itemInfo;
        itemInfo.cbSize = sizeof(itemInfo);
        itemInfo.fMask = MIIM_DATA;
        if (!::GetMenuItemInfo(hMenu, LOWORD(wParam), FALSE, &itemInfo))
          return TRUE;

        nsCOMPtr<nsIDOMEventListener> listener = (nsIDOMEventListener *) itemInfo.dwItemData;
        nsCOMPtr<nsIDOMEvent> event;
        CreateEvent(notificationArea->mWindow, NS_LITERAL_STRING("DOMActivate"), PR_FALSE, getter_AddRefs(event));

        if (event) {
          listener->HandleEvent(event);
        }
      }
      return FALSE;
    default:
      return ::CallWindowProc(DefWindowProc, hwnd, uMsg, wParam, lParam);
  }

  switch (lParam) {
    case WM_RBUTTONDOWN:
      if (hMenu) {
        ShowPopupMenu(hwnd, hMenu);
      }
      break;
    case WM_LBUTTONDOWN:
      if (notificationArea->mPrefs) {
        PRBool leftButtonMenu;
        if (NS_SUCCEEDED(notificationArea->mPrefs->GetBoolPref("leftButtonMenu", &leftButtonMenu)) && leftButtonMenu) {
          if (hMenu) {
            ShowPopupMenu(hwnd, hMenu);
          }
          return FALSE;
        }
      }
    case WM_LBUTTONDBLCLK:
      DispatchEvent(notificationArea->mWindow, nsnull, NS_LITERAL_STRING("DOMActivate"), PR_TRUE, nsnull);
      break;
  }

  PostMessage(hwnd, WM_NULL, 0, 0);

  return FALSE;
}

LRESULT CALLBACK
nsNotificationArea::WindowProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam)
{
  WNDPROC proc = (WNDPROC) GetProp(hwnd, S_PROPPROC);
  nsIDOMWindow* domWindow = (nsIDOMWindow *) GetProp(hwnd, S_PROPINST);
  nsAutoString typeArg;

  switch (uMsg) {
    case WM_NCLBUTTONDOWN:
      switch(wParam) {
        case HTMINBUTTON:
          typeArg = NS_LITERAL_STRING("minimizing");
          break;
        case HTMAXBUTTON:
          typeArg = NS_LITERAL_STRING("maximizing");
          break;
        case HTCLOSE:
          typeArg = NS_LITERAL_STRING("closing");
          break;
      }
      break;
    case WM_ACTIVATE:
      switch (LOWORD(wParam)) {
        case WA_ACTIVE:
        case WA_CLICKACTIVE:
          // window is being activated
          typeArg = NS_LITERAL_STRING("activating");
          break;
      }
      break;
    case WM_SIZE:
      switch (wParam) {
        case SIZE_MINIMIZED:
          typeArg = NS_LITERAL_STRING("minimizing");
          break;
        default:
          break;
      }
      break;
    case WM_SYSCOMMAND:
      switch (wParam) {
        case SC_CLOSE:
          // The user has clicked on the top left window icon and selected close...
          // Or the user typed Alt+F4.
          // Need to comment this out since right now there's no other way to close the app.
          // If we end up adding a menu bar we might want to revisit this.
          // typeArg = NS_LITERAL_STRING("closing");
          break;
      }
      break;
    case WM_CLOSE:
      // Closing the window so unhook
      ::SetWindowLong(hwnd, GWL_WNDPROC, (DWORD) proc);
      break;
  }

  if (!typeArg.IsEmpty()) {
    // dispatch the event q
    PRBool preventDefault;
    nsresult rv;
    rv = DispatchEvent(domWindow, nsnull, typeArg, PR_TRUE, &preventDefault);
    NS_ENSURE_SUCCESS(rv, rv);

    if (preventDefault)
      // event was hooked
      return FALSE;
  }

  return CallWindowProc(proc, hwnd, uMsg, wParam, lParam);
}

void nsNotificationArea::ShowPopupMenu(HWND hwnd, HMENU hmenu) {
  // Set window to foregroup so the menu goes away when we lose focus
  ::SetForegroundWindow(hwnd);

  POINT pos;
  ::GetCursorPos(&pos);

  ::TrackPopupMenu(hmenu, TPM_RIGHTALIGN, pos.x, pos.y, 0, hwnd, NULL);
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

NS_IMETHODIMP nsNotificationArea::CanCreateWrapper(const nsIID* iid, char **_retval) {
  *_retval = cloneAllAccess();
  return NS_OK;
}

NS_IMETHODIMP nsNotificationArea::CanCallMethod(const nsIID *iid, const PRUnichar *methodName, char **_retval) {
  *_retval = cloneAllAccess();
  return NS_OK;
}

NS_IMETHODIMP nsNotificationArea::CanGetProperty(const nsIID *iid, const PRUnichar *propertyName, char **_retval) {
  *_retval = cloneAllAccess();
  return NS_OK;
}

NS_IMETHODIMP nsNotificationArea::CanSetProperty(const nsIID *iid, const PRUnichar *propertyName, char **_retval) {
  if (iid->Equals(NS_GET_IID(nsIApplicationIcon))) {
    *_retval = cloneAllAccess();
  }
  else {
    *_retval = cloneNoAccess();
  }
  return NS_OK;
}
