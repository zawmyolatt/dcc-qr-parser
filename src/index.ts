import {decode as base45Decode} from 'base45';
import * as zlib from 'pako';
// import {decode as cborDecode} from 'cbor';

const URI_SCHEMA = 'HC1';

function buf2hex(buffer:ArrayBufferLike) { // buffer is an ArrayBuffer
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

function removePrefix(uri:string) {
  let data = uri;

  // Backwards compatibility.
  if (data.startsWith(URI_SCHEMA)) {
    data = data.substring(3)
    if (data.startsWith(':')) {
      data = data.substring(1)
    } else {
        return "Warning: unsafe HC1: header from older versions";
      };
    } else {
        return "Warning: no HC1: header from older versions";
  };
  return data;
}

function compressedPayload(uri:string) {
  const data = removePrefix(uri);

  try {
    let unencodedData = base45Decode(data);
    return unencodedData.toString('hex');
  } catch (err) {
    return JSON.stringify(err);
  }
}

function cosePayload(uri:string) {
  const data = removePrefix(uri);

  try {
    let unencodedData = base45Decode(data);
    let inflateData;

    // Check if it was zipped (Backwards compatibility.)
    if (unencodedData[0] == 0x78) {
        inflateData = zlib.inflate(unencodedData);
    }

    return inflateData ? buf2hex(inflateData.buffer): "";
  } catch (err) {
    return JSON.stringify(err);
  }
}

function cborPayload(uri:string) {
  const data = removePrefix(uri);
  let cborObj;

  try {
    let unencodedData = base45Decode(data);
    // Check if it was zipped (Backwards compatibility.)
    if (unencodedData[0] == 0x78) {
        cborObj = zlib.inflate(unencodedData);
    }
  } catch (err) {
    return JSON.stringify(err);
  }

  if (cborObj instanceof Buffer || cborObj instanceof Uint8Array) {
    try {  
      cborObj = cborDecode(cborObj);
      for (var key in cborObj) {
        cborObj[key] = cborPayload(cborObj[key]);
      }
    } catch {
      cborObj = cborObj.toString('base64');
    }
  } 

  if (Array.isArray(cborObj)) {
    for (let i=0; i<cborObj.length; i++) {
      cborObj[i] = cborPayload(cborObj[i])
    }
  }

  if (cborObj instanceof Map) {
    for (const [key, value] of cborObj.entries()) {
      cborObj.set(key, cborPayload(cborObj.get(key)));
    }
  }

  return cborObj.toString('hex');
}

class DCCInputHandler {

    constructor() {
        var inputQr = document.getElementById("qr") as HTMLInputElement;
        DCCInputHandler.showResult(inputQr);
    }

    public doWork(event: KeyboardEvent) {
        const target = event.target as HTMLElement;
        if (!DCCInputHandler.isDCCInput(target)) {
            return;
        }

        var inputElement = target as HTMLInputElement;
        DCCInputHandler.showResult(inputElement);
    }

    static showResult(inputElement: HTMLInputElement) {
        var removePrefixOutput = removePrefix(inputElement.value || "");
        var qrBase45 = document.getElementById("qrBase45");
        if (!qrBase45) {
            return;
        }
        qrBase45.innerHTML = removePrefixOutput;
        var compressedOutput = compressedPayload(inputElement.value || "");
        var compressed = document.getElementById("compressed");
        if (!compressed) {
            return;
        }
        compressed.innerHTML = compressedOutput;

        var coseOutput = cosePayload(inputElement.value || "");
        var cose = document.getElementById("cose");
        if (!cose) {
            return;
        }
        cose.innerHTML = coseOutput;

        // var cborOutput = cborPayload(inputElement.value || "");
        // var cbor = document.getElementById("cbor");
        // if (!cbor) {
        //     return;
        // }
        // cbor.innerHTML = cborOutput;

    }

    static isDCCInput(target: HTMLElement) {
        return target.tagName == 'TEXTAREA' && target.id == 'qr';
    }
}

window.onload = () => {
    var handler = new DCCInputHandler();
    document.addEventListener("keyup", handler.doWork);
};
