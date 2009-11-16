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
 * The Original Code is Operating System Integration extension.
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

#include "Iconfamily.h"

#include "nsICNSEncoder.h"

// nsStreamUtils is not available in XPCOM glue :-(
NS_COM NS_METHOD
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

// Input streams that do not implement nsIAsyncInputStream should be threadsafe
// so that they may be used with nsIInputStreamPump and nsIInputStreamChannel,
// which read such a stream on a background thread.
NS_IMPL_THREADSAFE_ISUPPORTS3(nsICNSEncoder, imgIEncoder, nsIInputStream,
  nsINativeIcon)

nsICNSEncoder::nsICNSEncoder() : mIconFamily(NULL), mIconData(NULL), mIconSize(0), mReadPosition(0)
{
}

nsICNSEncoder::~nsICNSEncoder()
{
}

// nsICNSEncoder::InitFromData
NS_IMETHODIMP nsICNSEncoder::InitFromData(const PRUint8* aData,
                                          PRUint32 aLength, // (unused, req'd by JS)
                                          PRUint32 aWidth,
                                          PRUint32 aHeight,
                                          PRUint32 aStride,
                                          PRUint32 aInputFormat,
                                          const nsAString& aOutputOptions)
{
  NS_ENSURE_TRUE(!mIconFamily, NS_ERROR_ALREADY_INITIALIZED);

  NSBitmapImageRep* imageRep = [[[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL
    pixelsWide:aWidth
    pixelsHigh:aHeight
    bitsPerSample:8
    samplesPerPixel:4
    hasAlpha:YES
    isPlanar:NO
    colorSpaceName:NSDeviceRGBColorSpace
    bitmapFormat:(NSBitmapFormat) ((int) NSAlphaNonpremultipliedBitmapFormat|(int) NSAlphaFirstBitmapFormat)
    bytesPerRow:aStride
    bitsPerPixel:0] autorelease];
   
  // Need to switch from big endian "host" format to native
  uint32_t* bitmapData = (uint32_t *) [imageRep bitmapData];
  for (PRUint32 i=0; i<aWidth*aHeight; i++)
    bitmapData[i] = CFSwapInt32BigToHost(((uint32_t *) aData)[i]);
   
  NSImage* image = [[NSImage alloc] initWithSize:NSMakeSize(aWidth, aHeight)];
  [image addRepresentation:imageRep];
 
  mIconFamily = (*[IconFamily iconFamilyWithThumbnailsOfImage:image]).hIconFamily;
 
  return NS_OK;
}


// nsICNSEncoder::StartImageEncode
//
//
// See ::InitFromData for other info.
NS_IMETHODIMP nsICNSEncoder::StartImageEncode(PRUint32 aaWidth,
                                             PRUint32 aaHeight,
                                             PRUint32 aInputFormat,
                                             const nsAString& aOutputOptions)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsICNSEncoder::AddImageFrame(const PRUint8* aData,
                                          PRUint32 aLength, // (unused, req'd by JS)
                                          PRUint32 aaWidth,
                                          PRUint32 aaHeight,
                                          PRUint32 aStride,
                                          PRUint32 aInputFormat,
                                          const nsAString& aFrameOptions)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsICNSEncoder::EndImageEncode()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void close (); */
NS_IMETHODIMP nsICNSEncoder::Close()
{
  return NS_OK;
}

/* unsigned long available (); */
NS_IMETHODIMP nsICNSEncoder::Available(PRUint32 *_retval)
{
  NS_ENSURE_TRUE(mIconFamily, NS_ERROR_NOT_INITIALIZED);
  *_retval = GetHandleSize((Handle) mIconFamily);
  return NS_OK;
}

/* [noscript] unsigned long read (in charPtr aBuf, in unsigned long aCount); */
NS_IMETHODIMP nsICNSEncoder::Read(char * aBuf, PRUint32 aCount,
                                 PRUint32 *_retval)
{
  return ReadSegments(NS_CopySegmentToBuffer, aBuf, aCount, _retval);
}

/* [noscript] unsigned long readSegments (in nsWriteSegmentFun aWriter, in voidPtr aClosure, in unsigned long aCount); */
NS_IMETHODIMP nsICNSEncoder::ReadSegments(nsWriteSegmentFun aWriter,
                                         void *aClosure, PRUint32 aCount,
                                         PRUint32 *_retval)
{
  NS_ENSURE_STATE(mIconFamily);
 
  PRUint32 iconSize = GetHandleSize((Handle) mIconFamily);
 
  if (!mIconData)
    mIconData = [NSData dataWithBytes:*((Handle) mIconFamily) length:iconSize];

  PRUint32 maxCount = iconSize-mReadPosition;
  if (maxCount == 0) {
    *_retval = 0;
    return NS_OK;
  }

  if (aCount > maxCount)
    aCount = maxCount;
  nsresult rv = aWriter(this, aClosure,
                        reinterpret_cast<const char*>([((NSData *) mIconData) bytes])+mReadPosition,
                        0, aCount, _retval);
  if (NS_SUCCEEDED(rv)) {
    NS_ASSERTION(*_retval <= aCount, "bad write count");
    mReadPosition += *_retval;
  }

  // errors returned from the writer end here!
  return NS_OK;
}

/* boolean isNonBlocking (); */
NS_IMETHODIMP nsICNSEncoder::IsNonBlocking(PRBool *_retval)
{
  *_retval = PR_FALSE;  // We don't implement nsIAsyncInputStream
  return NS_OK;
}

/* readonly attribute voidPtr handle; */
NS_IMETHODIMP nsICNSEncoder::GetHandle(void** _retval)
{
  return NS_OK;
}
