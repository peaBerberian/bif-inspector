import { IBifObject } from "./parser";

const currentUrls: string[] = [];

export function renderFetchingMessage() {
  cleanPreviousRender();
  const contentEl = getContentElt();
  contentEl.innerText = "Fetching BIF File...";
}

export function renderParsingMessage() {
  cleanPreviousRender();
  const contentEl = getContentElt();
  contentEl.innerText = "Parsing BIF File...";
}

export function renderLoadingMessage() {
  cleanPreviousRender();
  const contentEl = getContentElt();
  contentEl.innerText = "Loading BIF File...";
}

export function render(parsedBif: IBifObject) {
  cleanPreviousRender();
  const contentEl = getContentElt();
  contentEl.innerText = "Rendering parsed BIF File...";
  const containerElt = document.createElement("div");
  const metadataElt = document.createElement("pre");
  metadataElt.innerText =
    `version: ${parsedBif.version}\n` +
    `image count: ${parsedBif.imageCount}\n` +
    `framewise separation (milliseconds): ${parsedBif.framewiseSeparation}\n` +
    (
      parsedBif.format !== undefined ?
        `format: ${parsedBif.format}\n` :
        ""
    ) +
    (
      parsedBif.width !== undefined ?
        `width: ${parsedBif.width}\n` :
        ""
    ) +
    (
      parsedBif.height !== undefined ?
        `height: ${parsedBif.height}\n` :
        ""
    ) +
    (
      parsedBif.aspectRatio !== undefined ?
        `aspect ratio: ${parsedBif.aspectRatio}\n` :
        ""
    ) +
    (
      parsedBif.isVod !== undefined ?
        `is VoD: ${String(parsedBif.isVod)}\n` :
        ""
    );
  containerElt.appendChild(metadataElt);
  for (const image of parsedBif.thumbs) {
    const blob = new Blob([image.data], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    currentUrls.push(url);
    const imageElt = document.createElement("img");
    imageElt.className = "thumbnail";
    imageElt.src = url;

    const imageInfoElt = document.createElement("pre");
    imageInfoElt.innerText =
      `index: ${image.index}\n` +
      `time (milliseconds): ${image.ts}\n` +
      `duration (milliseconds): ${image.duration}\n`;
    imageInfoElt.style.position = "absolute";
    imageInfoElt.style.zIndex = "999";
    imageInfoElt.style.margin = "0px";
    imageInfoElt.style.padding = "5px";
    imageInfoElt.style.backgroundColor = "#004356";
    imageInfoElt.style.color = "#fff";
    imageInfoElt.style.display = "none";

    imageInfoElt.onmouseover = displayImageInfo;
    imageInfoElt.onmouseout = hideImageInfo;
    imageElt.onmouseout = hideImageInfo;
    imageElt.onmouseover = displayImageInfo;
    imageElt.onmousemove = displayImageInfo;

    function hideImageInfo() {
      imageInfoElt.style.display = "none";
    }
    function displayImageInfo() {
      imageInfoElt.style.top = `${imageElt.offsetTop}px`;
      imageInfoElt.style.left = `${imageElt.offsetLeft}px`;
      imageInfoElt.style.display = "block";
    }
    containerElt.appendChild(imageElt);
    containerElt.appendChild(imageInfoElt);
  }
  contentEl.innerHTML = "";
  contentEl.appendChild(containerElt);
}

function getContentElt() : HTMLElement {
  const contentEl = document.getElementById("content");
  if (contentEl === null) {
    throw new Error("Content element not found in the document");
  }
  return contentEl;
}

function cleanPreviousRender() {
  for (const prevUrl of currentUrls) {
    URL.revokeObjectURL(prevUrl);
  }
  currentUrls.length = 0;
  const contentEl = getContentElt();
  contentEl.innerHTML = "";
}

export function renderError(err: unknown) {
  cleanPreviousRender();
  const contentEl = getContentElt();
  const pElt = document.createElement("p");
  const message = err instanceof Error ? err.message : "Unknown Error";
  pElt.innerText = "Error: " + message;
  contentEl.appendChild(pElt);
}

