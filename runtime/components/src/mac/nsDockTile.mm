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
 *   Matthew Gertner <matthew@allpeers.com> (Original author)
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

#include <Carbon/Carbon.h>

#include "nsDockTile.h"

#include "nsStringAPI.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(nsDockTile, nsIApplicationTile)

nsDockTile::nsDockTile()
{
}

nsDockTile::~nsDockTile()
{
}

NS_IMETHODIMP nsDockTile::SetIcon(nsIFile* aIcon)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsDockTile::SetBadgeText(const nsAString& aBadgeText)
{
  if (aBadgeText.IsEmpty())
  {
    RestoreApplicationDockTileImage();
    return NS_OK;
  }
  
  CGContextRef context = ::BeginCGContextForApplicationDockTile();
 
  // Draw a circle.
 
  ::CGContextBeginPath(context);
  ::CGContextAddArc(context, 95.0, 95.0, 25.0, 0.0, 2 * M_PI, true);
  ::CGContextClosePath(context);
 
  // use #2fc600 for the color.
  ::CGContextSetRGBFillColor(context, 0.184, 0.776, 0.0, 1);
 
  //::CGContextSetRGBFillColor(context, 1.0, 1.0, 1.0, 0.7);
  ::CGContextFillPath(context);
 
  // Use a system font (kThemeUtilityWindowTitleFont)
  ScriptCode sysScript = ::GetScriptManagerVariable(smSysScript);
 
  Str255 fontName;
  SInt16 fontSize;
  Style fontStyle;
  ::GetThemeFont(kThemeSmallEmphasizedSystemFont, sysScript, fontName,
                 &fontSize, &fontStyle);
 
  FMFontFamily family = ::FMGetFontFamilyFromName(fontName);
  FMFont fmFont;
  OSStatus err = ::FMGetFontFromFontFamilyInstance(family, fontStyle, &fmFont,
                                                   nsnull);
  if (err != noErr)
	{
	  NS_WARNING("FMGetFontFromFontFamilyInstance failed");
	  ::EndCGContextForApplicationDockTile(context);
	  return NS_ERROR_FAILURE;
  }
 
  ATSUStyle style;
  err = ::ATSUCreateStyle(&style);
  if (err != noErr)
	{
    NS_WARNING("ATSUCreateStyle failed");
	  ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
	}
 
  Fixed size = Long2Fix(24);
  RGBColor white = { 0xFFFF, 0xFFFF, 0xFFFF };
 
  ATSUAttributeTag tags[3] = { kATSUFontTag, kATSUSizeTag, kATSUColorTag };
  ByteCount valueSizes[3] = { sizeof(ATSUFontID), sizeof(Fixed),
    sizeof(RGBColor) };
  ATSUAttributeValuePtr values[3] = { &fmFont, &size, &white };
 
  err = ::ATSUSetAttributes(style, 3, tags, valueSizes, values);
  if (err != noErr) {
    NS_WARNING("ATSUSetAttributes failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
   
    return NS_ERROR_FAILURE;
  }
 
  UniCharCount runLengths = kATSUToTextEnd;
  ATSUTextLayout textLayout;

  nsString text(aBadgeText);

  err = ::ATSUCreateTextLayoutWithTextPtr(text.get(),
                                          kATSUFromTextBeginning,
                                          kATSUToTextEnd, aBadgeText.Length(), 1,
                                          &runLengths, &style, &textLayout);
 
  if (err != noErr)
	{
    NS_WARNING("ATSUCreateTextLayoutWithTextPtr failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
   
    return NS_ERROR_FAILURE;
  }
 
  ATSUAttributeTag layoutTags[1] = { kATSUCGContextTag };
  ByteCount layoutValueSizes[1] = { sizeof(CGContextRef) };
  ATSUAttributeValuePtr layoutValues[1] = { &context };
 
  err = ::ATSUSetLayoutControls(textLayout, 1, layoutTags, layoutValueSizes,
                                layoutValues);
  if (err != noErr)
	{
    NS_WARNING("ATSUSetLayoutControls failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }
 
  Rect boundingBox;
  err = ::ATSUMeasureTextImage(textLayout, kATSUFromTextBeginning,
                               kATSUToTextEnd, Long2Fix(0), Long2Fix(0),
                               &boundingBox);
  if (err != noErr)
	{
    NS_WARNING("ATSUMeasureTextImage failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }
 
  // Center text inside circle
  err = ::ATSUDrawText(textLayout, kATSUFromTextBeginning, kATSUToTextEnd,
                       Long2Fix(90 - (boundingBox.right - boundingBox.left) / 2),
                       Long2Fix(95 - (boundingBox.bottom - boundingBox.top) / 2));
 
  ::ATSUDisposeStyle(style);
  ::ATSUDisposeTextLayout(textLayout);
 
  ::CGContextFlush(context);
 
  return NS_OK;
}
