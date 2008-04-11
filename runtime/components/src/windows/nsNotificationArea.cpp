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
 *   Matthew Gertner <matthew@allpeers.com>
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
#include "nsAutoPtr.h"
#include "nsComponentManagerUtils.h"
#include "nsMemory.h"
#include "nsIBufferedStreams.h"
#include "nsIChannel.h"
#include "nsINativeIcon.h"
#include "nsIIOService.h"
#include "nsIURI.h"
#include "nsServiceManagerUtils.h"
#include "nsStringAPI.h"

#pragma comment(lib, "shell32.lib")

const TCHAR* nsNotificationArea::S_PROPINST =
  TEXT("_NotificationArea_INST");
const TCHAR* nsNotificationArea::S_PROPPROC =
  TEXT("_NotificationArea_PROC");

ATOM nsNotificationArea::s_wndClass = NULL;

#define MK_ERROR_OFFSET       (0xE0000000 + (__LINE__ * 0x10000))

#define MK_ENSURE_NATIVE(res)                              \
  PR_BEGIN_MACRO                                           \
    NS_ENSURE_TRUE(0 != res || 0 == ::GetLastError(),      \
      ::GetLastError() + MK_ERROR_OFFSET);                 \
  PR_END_MACRO

// this can be WM_USER + anything
#define WM_TRAYICON (WM_USER + 0x17b6)

NS_IMPL_ISUPPORTS1(nsNotificationArea, nsINotificationArea)

nsNotificationArea::nsNotificationArea()
{
  /* member initializers and constructor code */
  mIconDataMap.Init();
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
nsNotificationArea::ShowIcon(
  const nsAString& aIconId,
  nsIURI* aImageURI,
  nsINotificationAreaListener* aListener
)
{
  nsresult rv;

  NOTIFYICONDATAW notifyIconData;
  if (mIconDataMap.Get(aIconId, &notifyIconData))
    // Already have an entry so just change the image
  {
    HICON hicon;
    rv = GetIconForURI(aImageURI, hicon);
    NS_ENSURE_SUCCESS(rv, rv);

    notifyIconData.hIcon = hicon;
    MK_ENSURE_NATIVE(Shell_NotifyIconW(NIM_MODIFY, &notifyIconData));

    return NS_OK;
  }

  rv = AddTrayIcon(aImageURI, aIconId, aListener);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::HideIcon(const nsAString& iconId)
{
  NOTIFYICONDATAW notifyIconData;
  if (!mIconDataMap.Get(iconId, &notifyIconData))
    // can't find the icon data
    return NS_ERROR_NOT_AVAILABLE;

  if (notifyIconData.hWnd) {
    nsINotificationAreaListener* listener =
      (nsINotificationAreaListener *) GetProp(notifyIconData.hWnd, S_PROPINST);
    NS_RELEASE(listener);

    ::DestroyWindow(notifyIconData.hWnd);
  }

  Shell_NotifyIconW(NIM_DELETE, &notifyIconData);

  mIconDataMap.Remove(iconId);

  return NS_OK;
}

nsresult
nsNotificationArea::AddTrayIcon(nsIURI* iconURI,
                                const nsAString& iconId,
                                nsINotificationAreaListener* listener)
{
  nsresult rv;

  NOTIFYICONDATAW notifyIconData;
  memset(&notifyIconData, 0, sizeof(NOTIFYICONDATAW));
  notifyIconData.cbSize = sizeof(NOTIFYICONDATAW);
  notifyIconData.uCallbackMessage = WM_TRAYICON;
  notifyIconData.uID = 1;
  notifyIconData.uFlags = NIF_MESSAGE | NIF_ICON;

  HICON hicon = NULL;
  if (iconURI)
  {
    rv = GetIconForURI(iconURI, hicon);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  if (!hicon)
    return NS_ERROR_FAILURE;

  notifyIconData.hIcon = hicon;

  HWND listenerWindow;
  rv = CreateListenerWindow(&listenerWindow, listener);
  NS_ENSURE_SUCCESS(rv, rv);

  // add the icon
  notifyIconData.hWnd = listenerWindow;
  MK_ENSURE_NATIVE(Shell_NotifyIconW(NIM_ADD, &notifyIconData));

  mIconDataMap.Put(iconId, notifyIconData);

  return NS_OK;
}


NS_IMETHODIMP
nsNotificationArea::SetTitle(const nsAString& iconId, const nsAString& title)
{
  NOTIFYICONDATAW notifyIconData;
  if (!mIconDataMap.Get(iconId, &notifyIconData))
    return NS_ERROR_NOT_AVAILABLE;

  notifyIconData.uFlags = NIF_TIP;
  PRUint32 length = title.Length();
  if (length > 64)
    length = 64;

  wcsncpy(notifyIconData.szTip, nsString(title).get(), length);

  MK_ENSURE_NATIVE(Shell_NotifyIconW(NIM_MODIFY, &notifyIconData));

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
nsNotificationArea::CreateListenerWindow(
  HWND* listenerWindow,
  nsINotificationAreaListener* listener
)
{
  ::SetLastError(0);
  HINSTANCE hInst = ::GetModuleHandle(NULL);
  MK_ENSURE_NATIVE(hInst);

  if (!nsNotificationArea::s_wndClass) {
    WNDCLASS wndClassDef;
    wndClassDef.style          = CS_NOCLOSE | CS_GLOBALCLASS;
    wndClassDef.lpfnWndProc    = nsNotificationArea::WindowProc;
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
    CW_USEDEFAULT,                        //height
    ::GetDesktopWindow(),                 //parent
    NULL,                                 //menu
    hInst,                                //hInst
    NULL);                                //param

  if (!*listenerWindow) {
    if (::UnregisterClass((LPCTSTR)nsNotificationArea::s_wndClass, hInst))
      nsNotificationArea::s_wndClass = NULL;
    MK_ENSURE_NATIVE(*listenerWindow);
  }

  MK_ENSURE_NATIVE(::SetProp(*listenerWindow, S_PROPINST, (HANDLE) listener));
  NS_ADDREF(listener);

  return NS_OK;
}

// a little helper class to automatically manage our reentrancy counter
// if we reenter WindowProc very bad things happen
class AutoReentryBlocker
{
public:
  AutoReentryBlocker(PRUint32* counter) { mCounter = counter; (*mCounter)++; }
  ~AutoReentryBlocker() { (*mCounter)--; }

protected:
  PRUint32* mCounter;
};

static PRUint32 numberOfCallsIntoWindowProc = 0;

LRESULT CALLBACK
nsNotificationArea::WindowProc(HWND hwnd,
                               UINT uMsg,
                               WPARAM wParam,
                               LPARAM lParam)
{
  if (numberOfCallsIntoWindowProc > 0)
    // don't reenter this function ever or we could crash (if the popup
    // frame is still being destroyed)
    return FALSE;

  AutoReentryBlocker blocker(&numberOfCallsIntoWindowProc);

  bool handled = true;

  PRUint16 button;
  PRUint16 clickCount;

  switch(uMsg) {
    case WM_TRAYICON:
      break;
    case WM_CREATE:
      return 0;
    case WM_NCCREATE:
      return true;
    default:
      handled = false;
  }

  nsCOMPtr<nsINotificationAreaListener> listener;
  if (handled) {
    listener = (nsINotificationAreaListener *) GetProp(hwnd, S_PROPINST);
  }

  if (!listener)
    handled = false;

  if (uMsg == WM_TRAYICON && handled) {
    switch (lParam) {
      case WM_LBUTTONUP:
        button = 0;
        clickCount = 1;
        break;
      case WM_RBUTTONUP:
        button = 2;
        clickCount = 1;
        break;
      case WM_MBUTTONUP:
        button = 1;
        clickCount = 1;
        break;
      case WM_CONTEXTMENU:
        button = 2;
        clickCount = 1;
        break;
      case WM_LBUTTONDBLCLK:
        button = 0;
        clickCount = 2;
        break;
      case WM_MBUTTONDBLCLK:
        button = 1;
        clickCount = 2;
        break;
      case WM_RBUTTONDBLCLK:
        button = 2;
        clickCount = 2;
        break;
      default:
        handled = false;
        break;
    }

    if (handled) {
      listener->OnNotificationAreaClick(button, clickCount);

      PostMessage(hwnd, WM_NULL, 0, 0);
      return FALSE;
    }
  }

  return ::CallWindowProc(
    DefWindowProc,
    hwnd,
    uMsg,
    wParam,
    lParam);
}
