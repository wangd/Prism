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
#include "nsArrayEnumerator.h"
#include "nsAutoPtr.h"
#include "nsComponentManagerUtils.h"
#include "nsCOMArray.h"
#include "nsMemory.h"
#include "nsIBufferedStreams.h"
#include "nsIChannel.h"
#include "nsIDOMAbstractView.h"
#include "nsIDOMDocument.h"
#include "nsIDOMDocumentEvent.h"
#include "nsIDOMDocumentView.h"
#include "nsIDOMElement.h"
#include "nsIDOMEvent.h"
#include "nsIDOMEventTarget.h"
#include "nsIDOMWindow.h"
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
#define WM_TRAYICON         (WM_USER + 0x17b6)
#define MENU_ITEM_BASE_ID   1000

NS_IMPL_ISUPPORTS3(nsNotificationArea, nsIApplicationIcon, nsINativeMenu, nsISecurityCheckedComponent)

nsNotificationArea::nsNotificationArea(nsIDOMWindow* aWindow) : mMenu(NULL)
{
  memset(&mIconData, 0, sizeof(NOTIFYICONDATAW));
  mWindow = aWindow;
  mLastMenuId = MENU_ITEM_BASE_ID;
}

nsNotificationArea::~nsNotificationArea()
{
  if (mMenu)
    ::DestroyMenu(mMenu);

  BOOL windowClassUnregistered = ::UnregisterClass(
    (LPCTSTR)nsNotificationArea::s_wndClass,
    ::GetModuleHandle(NULL));
  if (windowClassUnregistered)
    nsNotificationArea::s_wndClass = NULL;
}

NS_IMETHODIMP
nsNotificationArea::Show()
{
  NS_ENSURE_STATE(mWindow);
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
    HICON hicon;
    rv = GetIconForURI(imageURI, hicon);
    NS_ENSURE_SUCCESS(rv, rv);

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
  mTitle = aTitle;

  if (!mIconData.cbSize)
    // We'll set the title later when we display the tray icon.
    return NS_OK;

  mIconData.uFlags = NIF_TIP;
  PRUint32 length = aTitle.Length();
  if (length > 64)
    length = 64;

  wcsncpy(mIconData.szTip, nsString(aTitle).get(), length);

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
  mImageSpec = aImageSpec;
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
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNotificationArea::GetBadgeText(nsAString& aBadgeText)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNotificationArea::AddMenuItem(const nsAString& aId)
{
  nsresult rv;
  nsCOMPtr<nsIDOMElement> element;
  rv = GetElementById(aId, getter_AddRefs(element));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAutoString label;
  rv = element->GetAttribute(NS_LITERAL_STRING("label"), label);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!mMenu) {
    mMenu = ::CreatePopupMenu();
    NS_ENSURE_TRUE(mMenu, NS_ERROR_FAILURE);
  }
  
  PRUint32 itemId = mLastMenuId++;
  
  ::AppendMenuW(mMenu, MF_STRING, itemId, label.get());
  
  // Set the pointer to the element
  MENUITEMINFO itemInfo;
  itemInfo.cbSize = sizeof(itemInfo);
  itemInfo.fMask = MIIM_DATA;
  itemInfo.dwItemData = (DWORD_PTR) (nsIDOMElement *) element;
  ::SetMenuItemInfo(mMenu, itemId, FALSE, &itemInfo);

  return NS_OK;
}

NS_IMETHODIMP
nsNotificationArea::RemoveMenuItem(const nsAString& aId)
{
  NS_ENSURE_STATE(mMenu);

  nsresult rv;
  nsCOMPtr<nsIDOMElement> element;
  rv = GetElementById(aId, getter_AddRefs(element));
  NS_ENSURE_SUCCESS(rv, rv);

  MENUITEMINFO itemInfo;
  itemInfo.cbSize = sizeof(itemInfo);
  itemInfo.fMask = MIIM_DATA;
  PRUint32 i;
  for (i=0; ::GetMenuItemInfo(mMenu, i, TRUE, &itemInfo); i++) {
    if ((nsIDOMElement *) itemInfo.dwItemData == (nsIDOMElement *) element) {
      ::RemoveMenu(mMenu, i, MF_BYPOSITION);
      return NS_OK;
    }
  }
  
  return NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP
nsNotificationArea::GetItems(nsISimpleEnumerator** _retval)
{
  NS_ENSURE_STATE(mMenu);

  nsresult rv;
  nsCOMArray<nsIDOMElement> items;
  
  MENUITEMINFO itemInfo;
  itemInfo.cbSize = sizeof(itemInfo);
  itemInfo.fMask = MIIM_DATA;
  PRUint32 i;
  for (i=0; ::GetMenuItemInfo(mMenu, i, TRUE, &itemInfo); i++) {
    if (!items.AppendObject((nsIDOMElement *) itemInfo.dwItemData))
      return NS_ERROR_FAILURE;
  }
  
  return NS_NewArrayEnumerator(_retval, items);
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

  MK_ENSURE_NATIVE(::SetProp(*listenerWindow, S_PROPINST, (HANDLE) this));

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

  nsRefPtr<nsNotificationArea> notificationArea;
  notificationArea = (nsNotificationArea *)  GetProp(hwnd, S_PROPINST);

  if (!notificationArea)
    return TRUE;

  switch(uMsg) {
    case WM_TRAYICON:
      break;
    case WM_CREATE:
      return FALSE;
    case WM_NCCREATE:
      return TRUE;
    case WM_COMMAND:
      if (HIWORD(wParam) == 0)
        DispatchMenuEvent(notificationArea, LOWORD(wParam));
      return FALSE;
    default:
      return ::CallWindowProc(DefWindowProc, hwnd, uMsg, wParam, lParam);
  }

  switch (lParam) {
    case WM_RBUTTONDOWN:
      if (notificationArea->mMenu) {
        ShowPopupMenu(hwnd, notificationArea->mMenu);
      }
      break;
  }

  PostMessage(hwnd, WM_NULL, 0, 0);

  return FALSE;
}

void nsNotificationArea::ShowPopupMenu(HWND hwnd, HMENU hmenu) {
  POINT pos;
  ::GetCursorPos(&pos);

  ::TrackPopupMenu(hmenu, TPM_RIGHTALIGN, pos.x, pos.y, 0, hwnd, NULL);
}

nsresult nsNotificationArea::DispatchMenuEvent(nsNotificationArea* notificationArea, WORD menuId)
{
  NS_ENSURE_ARG(notificationArea);
  NS_ENSURE_STATE(notificationArea->mWindow);
  NS_ENSURE_STATE(notificationArea->mMenu);

  nsresult rv;

  nsCOMPtr<nsIDOMDocument> document;
  rv = notificationArea->mWindow->GetDocument(getter_AddRefs(document));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMDocumentEvent> documentEvent(do_QueryInterface(document, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMDocumentView> documentView(do_QueryInterface(document, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMAbstractView> abstractView;
  rv = documentView->GetDefaultView(getter_AddRefs(abstractView));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMEvent> event;
  rv = documentEvent->CreateEvent(NS_LITERAL_STRING("Events"), getter_AddRefs(event));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = event->InitEvent(NS_LITERAL_STRING("DOMActivate"), PR_TRUE, PR_TRUE);
  NS_ENSURE_SUCCESS(rv, rv);

  MENUITEMINFO itemInfo;
  itemInfo.cbSize = sizeof(itemInfo);
  itemInfo.fMask = MIIM_DATA;
  if (!::GetMenuItemInfo(notificationArea->mMenu, menuId, FALSE, &itemInfo))
    return NS_ERROR_NOT_AVAILABLE;
    
  nsCOMPtr<nsIDOMElement> element = (nsIDOMElement *) itemInfo.dwItemData;

  PRBool ret;
  nsCOMPtr<nsIDOMEventTarget> eventTarget(do_QueryInterface(element, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = eventTarget->DispatchEvent(event, &ret);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
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
