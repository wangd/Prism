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

#include "nsCRT.h"
#include "nsICOEncoder.h"
#include "prmem.h"
#include "prprf.h"
#include "nsStringAPI.h"

#include <windows.h>

struct ICONFILEHEADER {
  PRUint16 ifhReserved;
  PRUint16 ifhType;
  PRUint16 ifhCount;
};

struct ICONENTRY {
  PRInt8 ieWidth;
  PRInt8 ieHeight;
  PRUint8 ieColors;
  PRUint8 ieReserved;
  PRUint16 iePlanes;
  PRUint16 ieBitCount;
  PRUint32 ieSizeImage;
  PRUint32 ieFileOffset;
};

// nsStreamUtils is not available in XPCOM glue :-(
NS_METHOD
NS_CopySegmentToBuffer(nsIInputStream *inStr,
                       void *closure,
                       const char *buffer,
                       PRUint32 offset,
                       PRUint32 count,
                       PRUint32 *countWritten)
{
    char *toBuf = static_cast<char *>(closure);
    memcpy(&toBuf[offset], buffer, count);
    *countWritten = count;
    return NS_OK;
}

// Copied from windows/nsWindow.cpp. In my opinion this code should be
// moved to the encoder, which should be used by nsWindow.
/**
 * Convert the given image data to a HBITMAP. If the requested depth is
 * 32 bit and the OS supports translucency, a bitmap with an alpha channel
 * will be returned.
 *
 * @param aImageData The image data to convert. Must use the format accepted
 *                   by CreateDIBitmap.
 * @param aWidth     With of the bitmap, in pixels.
 * @param aHeight    Height of the image, in pixels.
 * @param aDepth     Image depth, in bits. Should be one of 1, 24 and 32.
 *
 * @return The HBITMAP representing the image. Caller should call
 *         DeleteObject when done with the bitmap.
 *         On failure, NULL will be returned.
 */
static HBITMAP DataToBitmap(const PRUint8* aImageData,
                            PRUint32 aWidth,
                            PRUint32 aHeight,
                            PRUint32 aDepth)
{
  HDC dc = ::GetDC(NULL);

#ifndef WINCE
  if (aDepth == 32) {
    // Alpha channel. We need the new header.
    BITMAPV4HEADER head = { 0 };
    head.bV4Size = sizeof(head);
    head.bV4Width = aWidth;
    head.bV4Height = aHeight;
    head.bV4Planes = 1;
    head.bV4BitCount = aDepth;
    head.bV4V4Compression = BI_BITFIELDS;
    head.bV4SizeImage = 0; // Uncompressed
    head.bV4XPelsPerMeter = 0;
    head.bV4YPelsPerMeter = 0;
    head.bV4ClrUsed = 0;
    head.bV4ClrImportant = 0;

    head.bV4RedMask   = 0x00FF0000;
    head.bV4GreenMask = 0x0000FF00;
    head.bV4BlueMask  = 0x000000FF;
    head.bV4AlphaMask = 0xFF000000;

    HBITMAP bmp = ::CreateDIBitmap(dc,
                                   reinterpret_cast<CONST BITMAPINFOHEADER*>(&head),
                                   CBM_INIT,
                                   aImageData,
                                   reinterpret_cast<CONST BITMAPINFO*>(&head),
                                   DIB_RGB_COLORS);
    ::ReleaseDC(NULL, dc);
    return bmp;
  }
#endif

  char reserved_space[sizeof(BITMAPINFOHEADER) + sizeof(RGBQUAD) * 2];
  BITMAPINFOHEADER& head = *(BITMAPINFOHEADER*)reserved_space;

  head.biSize = sizeof(BITMAPINFOHEADER);
  head.biWidth = aWidth;
  head.biHeight = aHeight;
  head.biPlanes = 1;
  head.biBitCount = (WORD)aDepth;
  head.biCompression = BI_RGB;
  head.biSizeImage = 0; // Uncompressed
  head.biXPelsPerMeter = 0;
  head.biYPelsPerMeter = 0;
  head.biClrUsed = 0;
  head.biClrImportant = 0;
 
  BITMAPINFO& bi = *(BITMAPINFO*)reserved_space;

  if (aDepth == 1) {
    RGBQUAD black = { 0, 0, 0, 0 };
    RGBQUAD white = { 255, 255, 255, 0 };

    bi.bmiColors[0] = white;
    bi.bmiColors[1] = black;
  }

  HBITMAP bmp = ::CreateDIBitmap(dc, &head, CBM_INIT, aImageData, &bi, DIB_RGB_COLORS);
  ::ReleaseDC(NULL, dc);
  return bmp;
}

// Input streams that do not implement nsIAsyncInputStream should be threadsafe
// so that they may be used with nsIInputStreamPump and nsIInputStreamChannel,
// which read such a stream on a background thread.
NS_IMPL_THREADSAFE_ISUPPORTS3(nsICOEncoder, imgIEncoder, nsIInputStream,
  nsINativeIcon)

nsICOEncoder::nsICOEncoder() :
  mIcon(NULL),
  mIconSize(0),
  mIconData(nsnull),
  mReadPosition(0)
{
}

nsICOEncoder::~nsICOEncoder()
{
  if (mIcon)
    Close();
}

// nsICOEncoder::InitFromData
NS_IMETHODIMP nsICOEncoder::InitFromData(const PRUint8* aData,
                                          PRUint32 aLength, // (unused, req'd by JS)
                                          PRUint32 aWidth,
                                          PRUint32 aHeight,
                                          PRUint32 aStride,
                                          PRUint32 aInputFormat,
                                          const nsAString& aOutputOptions)
{
  NS_ENSURE_TRUE(!mIcon, NS_ERROR_ALREADY_INITIALIZED);

  HBITMAP hBitmap = DataToBitmap(aData, aWidth, -((PRInt32) aHeight), 32);

  ICONINFO info = {0};
  info.fIcon = TRUE;
  info.xHotspot = 0;
  info.yHotspot = 0;
  info.hbmMask = hBitmap;
  info.hbmColor = hBitmap;
 
  mIcon = ::CreateIconIndirect(&info);
  ::DeleteObject(hBitmap);

  NS_ENSURE_TRUE(mIcon, NS_ERROR_FAILURE);

  return NS_OK;
}


// nsICOEncoder::StartImageEncode
//
//
// See ::InitFromData for other info.
NS_IMETHODIMP nsICOEncoder::StartImageEncode(PRUint32 aaWidth,
                                             PRUint32 aaHeight,
                                             PRUint32 aInputFormat,
                                             const nsAString& aOutputOptions)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsICOEncoder::AddImageFrame(const PRUint8* aData,
                                          PRUint32 aLength, // (unused, req'd by JS)
                                          PRUint32 aaWidth,
                                          PRUint32 aaHeight,
                                          PRUint32 aStride,
                                          PRUint32 aInputFormat,
                                          const nsAString& aFrameOptions)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsICOEncoder::EndImageEncode()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void close (); */
NS_IMETHODIMP nsICOEncoder::Close()
{
  NS_ENSURE_TRUE(mIcon, NS_BASE_STREAM_CLOSED);

  if (mIcon)
  {
    ::GlobalUnlock(mIcon);
    ::DestroyIcon(mIcon);
  }

  if (mIconData)
  {
    delete mIconData;
    mIconData = nsnull;
  }

  mIconSize = 0;
  mReadPosition = 0;

  return NS_OK;
}

/* unsigned long available (); */
NS_IMETHODIMP nsICOEncoder::Available(PRUint32 *_retval)
{
  NS_ENSURE_TRUE(mIcon, NS_BASE_STREAM_CLOSED);

  if (!mIconData)
  {
    nsresult rv = GenerateIconData();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  *_retval = mIconSize;

  return NS_OK;
}

/* [noscript] unsigned long read (in charPtr aBuf, in unsigned long aCount); */
NS_IMETHODIMP nsICOEncoder::Read(char * aBuf, PRUint32 aCount,
                                 PRUint32 *_retval)
{
  return ReadSegments(NS_CopySegmentToBuffer, aBuf, aCount, _retval);
}

/* [noscript] unsigned long readSegments (in nsWriteSegmentFun aWriter, in voidPtr aClosure, in unsigned long aCount); */
NS_IMETHODIMP nsICOEncoder::ReadSegments(nsWriteSegmentFun aWriter,
                                         void *aClosure, PRUint32 aCount,
                                         PRUint32 *_retval)
{
  NS_ENSURE_STATE(mIconData);

  PRUint32 maxCount = mIconSize - mReadPosition;
  if (maxCount == 0) {
    *_retval = 0;
    return NS_OK;
  }

  if (aCount > maxCount)
    aCount = maxCount;
  nsresult rv = aWriter(this, aClosure,
                        reinterpret_cast<const char*>(mIconData+mReadPosition),
                        0, aCount, _retval);
  if (NS_SUCCEEDED(rv)) {
    NS_ASSERTION(*_retval <= aCount, "bad write count");
    mReadPosition += *_retval;
  }

  // errors returned from the writer end here!
  return NS_OK;
}

/* boolean isNonBlocking (); */
NS_IMETHODIMP nsICOEncoder::IsNonBlocking(PRBool *_retval)
{
  *_retval = PR_FALSE;  // We don't implement nsIAsyncInputStream
  return NS_OK;
}

/* readonly attribute voidPtr handle; */
NS_IMETHODIMP nsICOEncoder::GetHandle(void** _retval)
{
  NS_ENSURE_STATE(mIcon);

  *_retval = mIcon;
  return NS_OK;
}

nsresult nsICOEncoder::GenerateIconData()
{
  NS_ENSURE_TRUE(mIcon, NS_ERROR_NOT_INITIALIZED);

  nsresult rv;
  ICONINFO iconInfo;
  if (!GetIconInfo(mIcon, &iconInfo))
    return NS_ERROR_FAILURE;

  // we got the bitmaps, first find out their size
  HDC hDC = CreateCompatibleDC(NULL); // get a device context for the screen.
  BITMAPINFO maskInfo = {{sizeof(BITMAPINFOHEADER)}};
  if (!GetDIBits(hDC, iconInfo.hbmMask, 0, 0, NULL, &maskInfo, DIB_RGB_COLORS))
    return NS_ERROR_FAILURE;

  if (maskInfo.bmiHeader.biSizeImage == 0)
  {
    // Image is empty so we're done
    mIconData = new char[1];
    return NS_OK;
  }

  PRUint32 colorSize = maskInfo.bmiHeader.biWidth * maskInfo.bmiHeader.biHeight * 4;
  mIconSize = sizeof(ICONFILEHEADER) + sizeof(ICONENTRY) + sizeof(BITMAPINFOHEADER) + colorSize + maskInfo.bmiHeader.biSizeImage;
  mIconData = new char[mIconSize];
  if (!mIconData)
    return NS_ERROR_OUT_OF_MEMORY;

  // the data starts with an icon file header
  ICONFILEHEADER *iconHeader = (ICONFILEHEADER *)mIconData;
  iconHeader->ifhReserved = 0;
  iconHeader->ifhType = 1;
  iconHeader->ifhCount = 1;
  // followed by the single icon entry
  ICONENTRY *iconEntry = (ICONENTRY *)(mIconData + sizeof(ICONFILEHEADER));
  iconEntry->ieWidth = (PRUint8) maskInfo.bmiHeader.biWidth;
  iconEntry->ieHeight = (PRUint8) maskInfo.bmiHeader.biHeight;
  iconEntry->ieColors = 0;
  iconEntry->ieReserved = 0;
  iconEntry->iePlanes = 1;
  iconEntry->ieBitCount = 32;
  iconEntry->ieSizeImage = sizeof(BITMAPINFOHEADER) + colorSize + maskInfo.bmiHeader.biSizeImage;
  iconEntry->ieFileOffset = sizeof(ICONFILEHEADER) + sizeof(ICONENTRY);
  // followed by the bitmap info header and the bits
  LPBITMAPINFO lpBitmapInfo = (LPBITMAPINFO)(mIconData + sizeof(ICONFILEHEADER) + sizeof(ICONENTRY));
  memcpy(lpBitmapInfo, &maskInfo.bmiHeader, sizeof(BITMAPINFOHEADER));
  if (!GetDIBits(hDC, iconInfo.hbmMask, 0, maskInfo.bmiHeader.biHeight, mIconData + sizeof(ICONFILEHEADER) + sizeof(ICONENTRY) + sizeof(BITMAPINFOHEADER) + colorSize, lpBitmapInfo, DIB_RGB_COLORS))
    return NS_ERROR_FAILURE;

  PRUint32 maskSize = lpBitmapInfo->bmiHeader.biSizeImage;
  lpBitmapInfo->bmiHeader.biBitCount = 32;
  lpBitmapInfo->bmiHeader.biSizeImage = colorSize;
  lpBitmapInfo->bmiHeader.biClrUsed = 0;
  lpBitmapInfo->bmiHeader.biClrImportant = 0;
  if (!GetDIBits(hDC, iconInfo.hbmColor, 0, maskInfo.bmiHeader.biHeight, mIconData + sizeof(ICONFILEHEADER) + sizeof(ICONENTRY) + sizeof(BITMAPINFOHEADER), lpBitmapInfo, DIB_RGB_COLORS))
    return NS_ERROR_FAILURE;

  // doubling the height because icons have two bitmaps
  lpBitmapInfo->bmiHeader.biHeight *= 2;
  lpBitmapInfo->bmiHeader.biSizeImage += maskSize;
 
  DeleteObject(iconInfo.hbmColor);
  DeleteObject(iconInfo.hbmMask);
  DeleteDC(hDC);

  return NS_OK;
}
