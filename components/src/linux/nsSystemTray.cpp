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
 * The Original Code is Mozilla Prism
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
 
#include "nsSystemTray.h"
#include "nsIDOMWindow.h"
#include "nsMemory.h"
#include "nsIAlertsService.h"
#include "nsServiceManagerUtils.h"

// Security helper
class SecurityHelper
{
public:
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
};

// nsSystemTray
NS_IMPL_ISUPPORTS3(nsSystemTray, nsIApplicationIcon, nsINativeMenu, nsISecurityCheckedComponent)

nsSystemTray::nsSystemTray(nsIDOMWindow* aWindow):
  m_window(aWindow), m_menu(NULL)
{
  //
}

nsSystemTray::~nsSystemTray()
{
  //
}

//nsIApplicationIcon

NS_IMETHODIMP nsSystemTray::SetTitle(const nsAString& aTitle)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::GetTitle(nsAString& aTitle)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::GetMenu(nsINativeMenu** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::SetImageSpec(const nsAString& aImageSpec)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::GetImageSpec(nsAString& aImageSpec)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::SetBadgeText(const nsAString& aBadgeText)
{
  return NS_OK;
}

NS_IMETHODIMP nsSystemTray::GetBadgeText(nsAString& aBadgeText)
{
  return NS_OK;
}

NS_IMETHODIMP nsSystemTray::GetBehavior(PRUint32* aBehavior)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::SetBehavior(PRUint32 aBehavior)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::Show()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::Hide()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::Minimize()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::ShowNotification(const nsAString& aTitle, const nsAString& aText,
                                            PRUint32 aTimeout, PRBool aIsClickable,
                                            nsIObserver* aAlertListener)
{
  nsresult rv;
  nsCOMPtr<nsIAlertsService> alerts(do_GetService("@mozilla.org/alerts-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = alerts->ShowAlertNotification(EmptyString(), aTitle, aText, aIsClickable, EmptyString(), nsnull, EmptyString());
  NS_ENSURE_SUCCESS(rv, rv);
  
  return NS_OK;
}

//nsINativeMenu

NS_IMETHODIMP nsSystemTray::GetHandle(void** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::GetItems(nsISimpleEnumerator** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::AddMenuItem(const nsAString& aId, const nsAString& aLabel,
                                        nsIDOMEventListener* aListener)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

nsresult nsSystemTray::AddSubmenu(const nsAString& aId, const nsAString& aLabel,
                                  nsINativeMenu** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::RemoveMenuItem(const nsAString& aId)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsSystemTray::RemoveAllMenuItems()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

//nsISecurityCheckedComponent

NS_IMETHODIMP nsSystemTray::CanCreateWrapper(const nsIID* iid, char **_retval)
{
  *_retval = SecurityHelper::cloneAllAccess();
  return NS_OK;
}

NS_IMETHODIMP nsSystemTray::CanCallMethod(const nsIID *iid, const PRUnichar *methodName,
                                          char **_retval)
{
  *_retval = SecurityHelper::cloneAllAccess();
  return NS_OK;
}

NS_IMETHODIMP nsSystemTray::CanGetProperty(const nsIID *iid, const PRUnichar *propertyName,
                                            char **_retval)
{
  *_retval = SecurityHelper::cloneAllAccess();
  return NS_OK;
}

NS_IMETHODIMP nsSystemTray::CanSetProperty(const nsIID *iid, const PRUnichar *propertyName,
                                            char **_retval)
{
  if (iid->Equals(NS_GET_IID(nsIApplicationIcon))) {
    *_retval = SecurityHelper::cloneAllAccess();
  }
  else {
    *_retval = SecurityHelper::cloneNoAccess();
  }
  return NS_OK;
}



