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
 
#ifndef ULONG_PTR
#define ULONG_PTR DWORD
#endif

#ifndef nsNotificationArea_h__
#define nsNotificationArea_h__

// needed for QueueUserAPC
#ifdef _WIN32_WINNT
#undef _WIN32_WINNT
#endif
#define _WIN32_WINNT  0x0400

#include <windows.h>
#include <shellapi.h>

#include "nsIApplicationTile.h"
#include "nsIDOMEventListener.h"
#include "nsINativeMenu.h"
#include "nsISecurityCheckedComponent.h"
#include "nsCOMPtr.h"
#include "nsDataHashtable.h"
#include "nsTArray.h"

class nsIDOMElement;
class nsIDOMDocument;
class nsIDOMEventTarget;
class nsIDOMWindow;
class nsIURI;

class nsNotificationArea : public nsIApplicationTile, public nsINativeMenu, public nsISecurityCheckedComponent
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIAPPLICATIONTILE
  NS_DECL_NSINATIVEMENU
  NS_DECL_NSISECURITYCHECKEDCOMPONENT

  nsNotificationArea(nsIDOMWindow* aWindow);
  virtual ~nsNotificationArea();

protected:
  nsresult AddTrayIcon(nsIURI* iconURI);
  nsresult GetIconForWnd(HWND hwnd, HICON& result);
  nsresult GetIconForURI(nsIURI* iconURI, HICON& result);
  nsresult CreateListenerWindow(HWND* listenerWindow);
  nsresult GetElementById(const nsAString& aId, nsIDOMElement** _retval);
  static void ShowPopupMenu(HWND hwnd, HMENU hmenu);
  static nsresult DispatchMenuEvent(nsNotificationArea* notificationArea, WORD menuId);

  static LRESULT CALLBACK WindowProc(
    HWND hwnd,
    UINT uMsg,
    WPARAM wParam,
    LPARAM lParam
    );

  /* additional members */
  static ATOM s_wndClass;
  NOTIFYICONDATAW mIconData;

  /* window property constants */
  static const TCHAR* S_PROPINST;
  static const TCHAR* S_PROPPROC;

  /* menu */
  HMENU mMenu;
  nsString mImageSpec;
  nsString mTitle;
  PRUint32 mLastMenuId;
  nsCOMPtr<nsIDOMWindow> mWindow;
};

#endif // nsNotificationArea_h__
