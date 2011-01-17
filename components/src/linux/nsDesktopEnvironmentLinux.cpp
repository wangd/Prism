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

#include "nsDesktopEnvironmentLinux.h"
#include "nsCOMPtr.h"
#include "nsIGConfService.h"
#include "nsIFile.h"
#include "nsServiceManagerUtils.h"

#include <sys/types.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

class AppCmdLineBuilder
{
public:
  AppCmdLineBuilder(nsCString const &appName, ArgMap const &appArgs)
  {
    m_cmdLine.Append(appName);
    m_cmdLine.Append(" ");
    appArgs.EnumerateRead(AppCmdLineBuilder::enumRead, this);
    m_cmdLine.Append("-url %s");
  }
  
  nsCString const& getCmdLine() const
  {
    return m_cmdLine;
  }
private:
  inline static PLDHashOperator enumRead(const nsACString &key, nsCString *val,
                                          void *builder)
  {
    AppCmdLineBuilder *inst = reinterpret_cast<AppCmdLineBuilder*>(builder);

    inst->m_cmdLine.Append(key);
    inst->m_cmdLine.Append(' ');
    inst->m_cmdLine.Append(*val);
    inst->m_cmdLine.Append(' ');
    
    return PL_DHASH_NEXT;
  }
private:
  nsCAutoString m_cmdLine;
};

NS_IMPL_ISUPPORTS2(nsDesktopEnvironment, nsIDesktopEnvironment, nsIWebProtocolService)

nsDesktopEnvironment::nsDesktopEnvironment()
{
  //
}

nsDesktopEnvironment::~nsDesktopEnvironment()
{
  //
}

NS_IMETHODIMP nsDesktopEnvironment::SetAutoStart(PRBool autoStart, PRBool iconic)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDesktopEnvironment::GetAutoStart(PRBool *aAutoStart)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDesktopEnvironment::CreateShortcut(const nsAString & name, nsIFile *target, 
                                                  nsIFile *location, const nsAString & workingPath, 
                                                  const nsAString & arguments, const nsAString & description, 
                                                  nsIFile *icon, nsIFile **_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDesktopEnvironment::HideDirectory(const nsAString & path)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDesktopEnvironment::GetApplicationIcon(nsIDOMWindow *window,
                                                      nsIApplicationIcon **_retval NS_OUTPARAM)
{
  NS_ENSURE_ARG(_retval);
  *_retval = nsnull;
  return NS_OK;
}

NS_IMETHODIMP nsDesktopEnvironment::SetZLevel(nsIDOMWindow *window, PRUint16 level)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDesktopEnvironment::GetSystemMenu(nsIDOMWindow *window,
                                                  nsINativeMenu **_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDesktopEnvironment::GetMenuBar(nsIDOMWindow *window,
                                                nsINativeMenu **_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDesktopEnvironment::RegisterProtocol(const nsAString& aScheme,
                                                    nsIFile* aApplicationFile,
                                                    const nsAString& /*aArguments*/)
{
  nsresult rv;
  nsCOMPtr<nsIGConfService> gConf(do_GetService("@mozilla.org/gnome-gconf-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAutoString appPath;
  if (aApplicationFile != NULL) {
    aApplicationFile->GetPath(appPath);
    m_regApp = NS_ConvertUTF16toUTF8(appPath);
  }
  else {
    nsCAutoString appCmdLine;
    rv = GetAppCmdLine(appCmdLine);
    NS_ENSURE_SUCCESS(rv, rv);
    
    PRInt32 oldUrlPos = appCmdLine.Find(" -url");
    if (oldUrlPos != -1) {
      appCmdLine.SetLength(oldUrlPos);
    }
    
    nsCAutoString appName;
    ArgMap appArgs;
    NS_ENSURE_TRUE(appArgs.Init(5), NS_ERROR_OUT_OF_MEMORY);
    rv = ParseAppCmdLine(appCmdLine, appName, appArgs);
    NS_ENSURE_SUCCESS(rv, rv);
    
    AppCmdLineBuilder cmdBuilder(appName, appArgs);
    appCmdLine = cmdBuilder.getCmdLine();
    
    appPath.Assign(NS_ConvertUTF8toUTF16(appCmdLine));
    m_regApp = appCmdLine;
  }
  
  return gConf->SetAppForProtocol(NS_ConvertUTF16toUTF8(aScheme),
                                  NS_ConvertUTF16toUTF8(appPath));
}

NS_IMETHODIMP nsDesktopEnvironment::UnregisterProtocol(const nsAString& aScheme)
{
  nsresult rv;
  nsCOMPtr<nsIGConfService> gConf(do_GetService("@mozilla.org/gnome-gconf-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  m_regApp.Truncate();
  return gConf->SetAppForProtocol(NS_ConvertUTF16toUTF8(aScheme), nsCAutoString());
}

NS_IMETHODIMP nsDesktopEnvironment::IsRegisteredProtocolHandler(const nsAString& aScheme, PRBool* _retval)
{
  nsresult rv;
  nsCOMPtr<nsIGConfService> gConf(do_GetService("@mozilla.org/gnome-gconf-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCAutoString regApp;
  rv = gConf->GetAppForProtocol(NS_ConvertUTF16toUTF8(aScheme), _retval, regApp);
  NS_ENSURE_SUCCESS(rv, rv);
    
  if (*_retval == PR_FALSE) {
    // application is not enabled
    return NS_OK;
  }
  
  // if application has been registered just now, 
  // GetAppForProtocol may report empty string
  if (regApp.Length() == 0)
  {
    regApp = m_regApp;
  }
  
  nsCAutoString appCmdLine;
  rv = GetAppCmdLine(appCmdLine);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCAutoString appName;
  ArgMap appArgs;
  NS_ENSURE_TRUE(appArgs.Init(5), NS_ERROR_OUT_OF_MEMORY);
  rv = ParseAppCmdLine(appCmdLine, appName, appArgs);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCAutoString regAppName;
  ArgMap regAppArgs;
  NS_ENSURE_TRUE(regAppArgs.Init(5), NS_ERROR_OUT_OF_MEMORY);
  rv = ParseAppCmdLine(regApp, regAppName, regAppArgs);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (appName != regAppName) {
    *_retval = PR_FALSE;
  }
  else {
    *_retval = PR_TRUE;
    
    char const* checkArgs[] = { "-webapp" };
    int const numCheckArgs = 1;
    
    for (int i = 0; i < numCheckArgs; ++i) {
      nsCAutoString key(checkArgs[i]);
      nsCAutoString *val1 = NULL;
      nsCAutoString *val2 = NULL;
      if (appArgs.Get(key, &val1) == PR_FALSE ||
          regAppArgs.Get(key, &val2) == PR_FALSE) {
          *_retval = PR_FALSE;
          return NS_OK;
      }
  
      *_retval = *val1 == *val2 ? PR_TRUE : PR_FALSE;
      if (*_retval == PR_FALSE) {
        return NS_OK;
      }
    }
  }
  
  return NS_OK;
}

nsresult nsDesktopEnvironment::GetAppCmdLine(nsCString &outAppCmdLine)
{
  FILE *cmdFile = fopen("/proc/self/cmdline", "rb");
  if (cmdFile != NULL) {
    // for some reason file /proc/self/cmdline is not seekable
    
    char cmdLine[1024] = { '\0' };
    size_t fileLen = fread(cmdLine, sizeof(char), sizeof(cmdLine) / sizeof(char), cmdFile);
    fclose(cmdFile);
    
    for (int i = 0; i < fileLen - 1; ++i) {
      if (cmdLine[i] == '\0') {
        cmdLine[i] = ' ';
      }
    }
    outAppCmdLine = cmdLine;
    
    return NS_OK;
  }
  return NS_ERROR_FAILURE;
}

nsresult nsDesktopEnvironment::ParseAppCmdLine(nsCString const &appCmdLine,
                                  nsCString &outAppName, ArgMap &outArgs) const
{
  // copy expanded program path to output buffer
  PRInt32 progPos = appCmdLine.Find(" ");
  nsCAutoString appName = appCmdLine;
  if (progPos != -1) {
    appName.SetLength(progPos);
  }
  
  char *canonicalPath = realpath(appName.get(), NULL);
  if (canonicalPath != NULL) {
    outAppName = canonicalPath;
    free(canonicalPath);
  }
  else {
    outAppName = appName;
  }
  
  nsCAutoString argStr(" -");
  nsCAutoString argSpace(" ");
  while (progPos != -1) {
    progPos = appCmdLine.Find(argStr, progPos);
    if (progPos != -1) {
      nsCAutoString argName;
      nsCAutoString argValue;
      
      PRInt32 endPos = appCmdLine.Find(argSpace, progPos + 1);
      if (endPos != -1) {
        argName = Substring(appCmdLine, progPos + 1, endPos - progPos - 1);
        progPos = appCmdLine.Find(argSpace, endPos + 1);
        if (progPos != -1) {
          argValue = Substring(appCmdLine, endPos + 1, progPos - endPos - 1);
        }
        else {
          argValue = Substring(appCmdLine, endPos + 1);
        }
      }
      
      outArgs.Put(argName, new nsCString(argValue));
    }
  }
  
  return NS_OK;
}

