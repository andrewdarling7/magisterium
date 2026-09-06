(() => {
  "use strict";

  const manifest = window.BOOKSCANS_MANIFEST || {};
  const contents = window.BOOKSCANS_CONTENTS || {};
  const contentTitles = window.BOOKSCANS_CONTENT_TITLES || {};
  const IMAGE_BASE_URL = "https://pub-d7b82b7b83a446c3a0d38692c1b8dde6.r2.dev";
  const BOOK_ORDER = Object.keys(manifest).sort((a,b) => a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"}));
  const $ = id => document.getElementById(id);
  const els = { bookSelect:$("bookSelect"),pageForm:$("pageForm"),pageInput:$("pageInput"),pageImage:$("pageImage"),pageStage:$("pageStage"),emptyState:$("emptyState"),prevBtn:$("prevBtn"),nextBtn:$("nextBtn"),positionText:$("positionText"),fileText:$("fileText"),pageSlider:$("pageSlider"),sliderBubble:$("sliderBubble"),breadcrumb:$("breadcrumb"),tocToggle:$("tocToggle"),tocPanel:$("tocPanel"),tocClose:$("tocClose"),tocExpandAll:$("tocExpandAll"),tocBookTitle:$("tocBookTitle"),tocTree:$("tocTree"),tocEmpty:$("tocEmpty"),sectionMarkers:$("sectionMarkers") };
  let currentBook = "", currentIndex = 0, sliderEngaged = false, imageZoom = 1, imagePanX = 0, imagePanY = 0, gestureStartZoom = 1;
  const nodeElements = new Map();
  const markerElements = new Map();
  const highlightTimers = new Map();
  const sortedFiles = new Map();

  function filesFor(book) {
    if(sortedFiles.has(book))return sortedFiles.get(book);
    const files=Array.isArray(manifest[book])?[...manifest[book]]:[];
    files.sort((a,b)=>{const pa=parseScanName(a),pb=parseScanName(b);if(!pa&&!pb)return 0;if(!pa)return 1;if(!pb)return -1;return pa.number-pb.number||pa.suffix.localeCompare(pb.suffix,undefined,{numeric:true,sensitivity:"base"});});
    sortedFiles.set(book,files);return files;
  }
  const tocFor = book => Array.isArray(contents[book]) ? contents[book] : [];
  function parseScanName(filename) {
    const m = filename.match(/[-_](\d{3,})([a-z]*)\.(jpe?g)$/i);
    return m ? { number:Number(m[1]), suffix:m[2].toLowerCase() } : null;
  }
  function printedPageLabel(filename) {
    const p=parseScanName(filename); if(!p) return "";
    return p.suffix ? `${String(p.number).padStart(3,"0")}${p.suffix}` : `${p.number}–${p.number+1}`;
  }
  function plainTitle(title) { return title.replace(/\*+/g, ""); }
  function formattedTitle(title) {
    const fragment=document.createDocumentFragment();
    const re=/(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let last=0, match;
    while((match=re.exec(title))) {
      fragment.append(document.createTextNode(title.slice(last,match.index)));
      const el=document.createElement(match[2]?"strong":match[3]?"strong":"em");
      if(match[2]) { const em=document.createElement("em"); em.textContent=match[2]; el.append(em); }
      else el.textContent=match[3]||match[4];
      fragment.append(el); last=re.lastIndex;
    }
    fragment.append(document.createTextNode(title.slice(last))); return fragment;
  }
  function indexForPrintedPage(book, rawPage) {
    const token=String(rawPage??"").trim().toLowerCase(),match=token.match(/^(\d+)([a-z]*)$/i);
    if(!match)return -1;
    const wanted=Number(match[1]),suffix=match[2];if(!Number.isInteger(wanted)||wanted<0)return -1;
    const files=filesFor(book);
    if(suffix)return files.findIndex(f=>{const p=parseScanName(f);return p&&p.number===wanted&&p.suffix===suffix;});
    const target=wanted%2===0?wanted:wanted-1;
    let i=files.findIndex(f=>{const p=parseScanName(f);return p&&p.number===target&&!p.suffix;});
    if(i<0) i=files.findIndex(f=>{const p=parseScanName(f);return p&&p.number===target;});
    return i;
  }
  function activePathForIndex(index) {
    const path=[]; let siblings=tocFor(currentBook);
    while(siblings.length) {
      const eligible=siblings.map(n=>({node:n,index:indexForPrintedPage(currentBook,n.page)})).filter(entry=>entry.index>=0&&entry.index<=index);
      if(!eligible.length) break;
      const selected=eligible.reduce((best,entry)=>!best||entry.index>best.index||(entry.index===best.index&&entry.node.order>best.node.order)?entry:best,null);
      const node=selected.node;
      path.push(node); siblings=node.children||[];
    }
    return path;
  }
  function fitImageToStage() {
    if(!els.pageImage.naturalWidth||!els.pageImage.naturalHeight) return;
    const s=getComputedStyle(els.pageStage), w=els.pageStage.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight), h=els.pageStage.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);
    if(w<=0||h<=0)return; const scale=Math.min(w/els.pageImage.naturalWidth,h/els.pageImage.naturalHeight);
    els.pageImage.style.width=`${Math.floor(els.pageImage.naturalWidth*scale)}px`; els.pageImage.style.height=`${Math.floor(els.pageImage.naturalHeight*scale)}px`;setImagePan(imagePanX,imagePanY);
  }
  function panLimits() {
    const styles=getComputedStyle(els.pageStage);
    const stageWidth=els.pageStage.clientWidth-parseFloat(styles.paddingLeft)-parseFloat(styles.paddingRight);
    const stageHeight=els.pageStage.clientHeight-parseFloat(styles.paddingTop)-parseFloat(styles.paddingBottom);
    const stageRect=els.pageStage.getBoundingClientRect(),panelRect=els.tocPanel.getBoundingClientRect();
    const panelOverlap=document.body.classList.contains("toc-open")?Math.max(0,Math.min(stageRect.right,panelRect.right)-Math.max(stageRect.left,panelRect.left)):0;
    const horizontal=Math.max(0,(els.pageImage.offsetWidth*imageZoom-stageWidth)/2),vertical=Math.max(0,(els.pageImage.offsetHeight*imageZoom-stageHeight)/2);
    return {minX:-horizontal,maxX:horizontal+panelOverlap,y:vertical};
  }
  function setImagePan(x,y) {
    const limits=panLimits();imagePanX=Math.max(limits.minX,Math.min(limits.maxX,x));imagePanY=Math.max(-limits.y,Math.min(limits.y,y));
    els.pageImage.style.setProperty("--image-pan-x",`${imagePanX}px`);els.pageImage.style.setProperty("--image-pan-y",`${imagePanY}px`);
  }
  function setImageZoom(value) {
    imageZoom=Math.max(1,Math.min(5,value));
    els.pageImage.style.setProperty("--image-zoom",String(imageZoom));
    els.pageStage.classList.toggle("image-zoomed",imageZoom>1.001);
    if(imageZoom<=1.001)setImagePan(0,0);else setImagePan(imagePanX,imagePanY);
  }
  function updateUrl() {
    const files=filesFor(currentBook); if(!files.length)return;
    const params=new URLSearchParams(location.search); params.set("book",currentBook);
    const p=parseScanName(files[currentIndex]); if(p)params.set("page",p.suffix?`${String(p.number).padStart(3,"0")}${p.suffix}`:String(p.number));else params.delete("page");
    history.replaceState(null,"",`${location.pathname}?${params}${location.hash}`);
  }
  function pathText(index) { return activePathForIndex(index).map(n=>plainTitle(n.title)).join(" › "); }
  function updateSliderBubble(index) {
    const files=filesFor(currentBook); if(!files.length)return;
    const safe=Math.max(0,Math.min(index,files.length-1)), pct=safe/Math.max(1,files.length-1), path=pathText(safe);
    els.sliderBubble.replaceChildren();
    if(path){const a=document.createElement("span");a.className="bubble-path";a.textContent=path;els.sliderBubble.append(a);}
    const b=document.createElement("span");b.className="bubble-page";b.textContent=`Pages ${printedPageLabel(files[safe])}`;els.sliderBubble.append(b);
    els.pageSlider.style.setProperty("--slider-progress",`${pct*100}%`); const inset=10; els.sliderBubble.style.left=`calc(${pct*100}% + ${inset-pct*inset*2}px)`;
  }
  function setTocOpen(open) { document.body.classList.toggle("toc-open",open); els.tocToggle.setAttribute("aria-expanded",String(open)); els.tocPanel.setAttribute("aria-hidden",String(!open)); setTimeout(fitImageToStage,240); }
  function setCrossHighlight(node,on) {
    nodeElements.get(node)?.row.classList.toggle("cross-highlight",on);
    markerElements.get(node)?.classList.toggle("cross-highlight",on);
  }
  function pulseCrossHighlight(node) {
    clearTimeout(highlightTimers.get(node)); setCrossHighlight(node,true);
    highlightTimers.set(node,setTimeout(()=>{setCrossHighlight(node,false);highlightTimers.delete(node);},1100));
  }
  function updateExpandAllButton() {
    const branches=[...els.tocTree.querySelectorAll(".toc-item:has(> .toc-children)")];
    const allOpen=branches.length>0&&branches.every(item=>item.classList.contains("expanded"));
    els.tocExpandAll.disabled=branches.length===0;
    els.tocExpandAll.textContent=allOpen?"Close All":"Expand All";
    els.tocExpandAll.setAttribute("aria-label",allOpen?"Close all contents sections":"Expand all contents sections");
  }
  function setAllBranches(open) {
    els.tocTree.querySelectorAll(".toc-item:has(> .toc-children)").forEach(item=>{item.classList.toggle("expanded",open);const children=item.querySelector(":scope > .toc-children");if(children)children.hidden=!open;});
    updateExpandAllButton();
  }
  function makeTocItem(node) {
    const item=document.createElement("div"); item.className="toc-item"; item.dataset.level=node.level;
    const row=document.createElement("div"); row.className=`toc-row ${node.level===0?"level-0":node.level===1?"level-1":node.level===2?"level-2":"level-deep"}`; row.style.paddingLeft=`${5+Math.min(node.level,4)*15}px`;
    const disclosure=document.createElement("button"); disclosure.type="button"; disclosure.className=`toc-disclosure${node.children.length?"":" placeholder"}`; disclosure.setAttribute("aria-label",`Toggle ${plainTitle(node.title)}`);
    const link=document.createElement("button"); link.type="button"; link.className="toc-link"; link.append(formattedTitle(node.title)); link.title=`Go to page ${node.page}`;
    row.append(disclosure,link); item.append(row); nodeElements.set(node,{item,row});
    row.addEventListener("mouseenter",()=>setCrossHighlight(node,true));row.addEventListener("mouseleave",()=>{if(!highlightTimers.has(node))setCrossHighlight(node,false);});
    if(node.children.length){const children=document.createElement("div");children.className="toc-children";children.hidden=true;node.children.forEach(n=>children.append(makeTocItem(n)));item.append(children);disclosure.addEventListener("click",()=>{const open=!item.classList.contains("expanded");item.classList.toggle("expanded",open);children.hidden=!open;updateExpandAllButton();});}
    link.addEventListener("click",()=>{pulseCrossHighlight(node);goToPrintedPage(node.page);}); return item;
  }
  function buildToc() {
    nodeElements.clear(); markerElements.clear(); highlightTimers.forEach(clearTimeout);highlightTimers.clear();els.tocTree.replaceChildren(); els.tocBookTitle.textContent=contentTitles[currentBook]||currentBook;
    const tree=tocFor(currentBook); els.tocEmpty.hidden=tree.length>0; els.tocTree.hidden=!tree.length;
    tree.forEach(n=>els.tocTree.append(makeTocItem(n))); updateExpandAllButton();buildMarkers();
  }
  function buildMarkers() {
    els.sectionMarkers.replaceChildren(); const files=filesFor(currentBook); if(files.length<2)return;
    const nodes=[]; const collect=items=>items.forEach(n=>{if(n.level<=1)nodes.push(n);collect(n.children||[]);}); collect(tocFor(currentBook));
    nodes.forEach(node=>{const index=indexForPrintedPage(currentBook,node.page);if(index<0)return;const button=document.createElement("button");button.type="button";button.className=`section-marker${node.level===0?" major":""}`;button.style.left=`${index/(files.length-1)*100}%`;button.title=`${plainTitle(node.title)} — page ${node.page}`;button.setAttribute("aria-label",button.title);markerElements.set(node,button);button.addEventListener("mouseenter",()=>setCrossHighlight(node,true));button.addEventListener("mouseleave",()=>{if(!highlightTimers.has(node))setCrossHighlight(node,false);});button.addEventListener("click",()=>{pulseCrossHighlight(node);const entry=nodeElements.get(node);if(entry&&document.body.classList.contains("toc-open"))entry.row.scrollIntoView({block:"nearest"});goToPrintedPage(node.page);});els.sectionMarkers.append(button);});
  }
  function drawBreadcrumb(path) {
    els.breadcrumb.replaceChildren();
    path.forEach((node,index)=>{
      if(index){const separator=document.createElement("span");separator.className="crumb-separator";separator.textContent="›";els.breadcrumb.append(separator);}
      const span=document.createElement("span");span.className=`crumb ${index===path.length-1?"crumb-current":"crumb-parent"}`;span.title=plainTitle(node.title);span.append(formattedTitle(node.title));els.breadcrumb.append(span);
    });
  }
  function fitBreadcrumb(path) {
    drawBreadcrumb(path);
    const parents=[...els.breadcrumb.querySelectorAll(".crumb-parent")];
    if(!parents.length)return;
    const current=els.breadcrumb.querySelector(".crumb-current");
    const separators=[...els.breadcrumb.querySelectorAll(".crumb-separator")];
    const used=(current?.scrollWidth||0)+separators.reduce((sum,el)=>sum+el.offsetWidth,0);
    const available=Math.max(parents.length*28,els.breadcrumb.clientWidth-used);
    const naturalTotal=parents.reduce((sum,el)=>sum+el.scrollWidth,0);
    if(naturalTotal<=available)return;
    const weights=parents.map((_,i)=>i+1),weightTotal=weights.reduce((a,b)=>a+b,0);
    parents.forEach((el,i)=>{const share=Math.max(28,available*weights[i]/weightTotal);el.style.maxWidth=`${Math.min(el.scrollWidth,share)}px`;});
  }
  function updateNavigationContext() {
    const path=activePathForIndex(currentIndex); fitBreadcrumb(path);
    nodeElements.forEach(({row})=>row.classList.remove("active"));
    path.forEach(node=>{const entry=nodeElements.get(node);if(!entry)return;entry.row.classList.add("active");let parent=entry.item.parentElement?.closest(".toc-item");while(parent){parent.classList.add("expanded");const c=parent.querySelector(":scope > .toc-children");if(c)c.hidden=false;parent=parent.parentElement?.closest(".toc-item");}});
    const active=path.length?nodeElements.get(path[path.length-1]):null; if(active&&document.body.classList.contains("toc-open"))active.row.scrollIntoView({block:"nearest"});updateExpandAllButton();
  }
  function render(direction=0,{updateAddress=true}={}) {
    const files=filesFor(currentBook);
    if(!files.length){els.pageImage.removeAttribute("src");els.pageImage.hidden=true;els.emptyState.hidden=false;els.prevBtn.disabled=els.nextBtn.disabled=true;els.positionText.textContent="";els.fileText.textContent=`${currentBook}: no files listed in manifest.js`;els.pageSlider.min=els.pageSlider.max=els.pageSlider.value="0";els.pageSlider.disabled=true;return;}
    els.emptyState.hidden=true;els.pageImage.hidden=false;currentIndex=Math.max(0,Math.min(currentIndex,files.length-1));const filename=files[currentIndex];imagePanX=imagePanY=0;setImageZoom(1);
    if(direction){els.pageImage.classList.remove("turning-left","turning-right");void els.pageImage.offsetWidth;els.pageImage.classList.add(direction<0?"turning-left":"turning-right");}
    const src=`${IMAGE_BASE_URL}/${encodeURIComponent(currentBook)}/${filename.split("/").map(encodeURIComponent).join("/")}`, preload=new Image();
    preload.onload=()=>{els.pageImage.onload=fitImageToStage;els.pageImage.src=src;els.pageImage.alt=`${currentBook}, scan ${printedPageLabel(filename)}`;requestAnimationFrame(()=>els.pageImage.classList.remove("turning-left","turning-right"));};
    preload.onerror=()=>{els.pageImage.removeAttribute("src");els.pageImage.alt="";els.fileText.textContent=`Could not load ${currentBook}/${filename}`;};preload.src=src;
    els.prevBtn.disabled=currentIndex===0;els.nextBtn.disabled=currentIndex===files.length-1;els.positionText.textContent=`Pages ${printedPageLabel(filename)}`;els.fileText.textContent=`${currentBook}/${filename}  ·  printed pages ${printedPageLabel(filename)}`;
    Object.assign(els.pageSlider,{disabled:false,min:"0",max:String(files.length-1),value:String(currentIndex)});updateSliderBubble(currentIndex);updateNavigationContext();localStorage.setItem("bookscans-book",currentBook);localStorage.setItem(`bookscans-index-${currentBook}`,String(currentIndex));if(updateAddress)updateUrl();
  }
  function initialIndexForBook(book) {const p=new URLSearchParams(location.search).get("page");if(p!==null){const i=indexForPrintedPage(book,p);if(i>=0)return i;}const saved=Number(localStorage.getItem(`bookscans-index-${book}`));return Number.isFinite(saved)?saved:0;}
  function changeBook(book,{useUrlPage=false}={}) {currentBook=book;currentIndex=useUrlPage?initialIndexForBook(book):Number(localStorage.getItem(`bookscans-index-${book}`))||0;els.bookSelect.value=book;buildToc();render();}
  function go(delta){const next=currentIndex+delta;if(next<0||next>=filesFor(currentBook).length)return;currentIndex=next;render(delta);}
  function goToPrintedPage(raw){const token=String(raw??"").trim().toLowerCase(),match=token.match(/^(\d+)([a-z]*)$/i);if(!match)return;const wanted=Number(match[1]),suffix=match[2],index=indexForPrintedPage(currentBook,token);if(index>=0){const direction=Math.sign(index-currentIndex);currentIndex=index;render(direction);els.pageInput.value=suffix?`${String(wanted).padStart(3,"0")}${suffix}`:String(wanted);}else{const expected=suffix?`${String(wanted).padStart(3,"0")}${suffix}`:String(wanted%2===0?wanted:wanted-1).padStart(3,"0");els.pageInput.setCustomValidity(`No scan for page ${token} (expected ${expected}).`);els.pageInput.reportValidity();setTimeout(()=>els.pageInput.setCustomValidity(""),1800);}}
  function populateBooks(){els.bookSelect.replaceChildren();BOOK_ORDER.forEach(book=>{const o=document.createElement("option");o.value=o.textContent=book;els.bookSelect.append(o);});const p=new URLSearchParams(location.search).get("book"),saved=localStorage.getItem("bookscans-book");currentBook=BOOK_ORDER.includes(p)?p:BOOK_ORDER.includes(saved)?saved:BOOK_ORDER[0]||"";}

  els.tocToggle.addEventListener("click",()=>setTocOpen(!document.body.classList.contains("toc-open")));els.tocClose.addEventListener("click",()=>setTocOpen(false));els.tocExpandAll.addEventListener("click",()=>setAllBranches(els.tocExpandAll.textContent==="Expand All"));els.bookSelect.addEventListener("change",()=>changeBook(els.bookSelect.value));els.prevBtn.addEventListener("click",()=>go(-1));els.nextBtn.addEventListener("click",()=>go(1));els.pageForm.addEventListener("submit",e=>{e.preventDefault();goToPrintedPage(els.pageInput.value);});
  const engage=()=>{sliderEngaged=true;els.sliderBubble.hidden=false;updateSliderBubble(Number(els.pageSlider.value));},disengage=()=>{sliderEngaged=false;els.sliderBubble.hidden=true;};
  ["pointerdown","mousedown","touchstart"].forEach(type=>els.pageSlider.addEventListener(type,engage,{passive:true}));els.pageSlider.addEventListener("input",()=>{const i=Number(els.pageSlider.value);updateSliderBubble(i);if(!sliderEngaged)engage();if(i!==currentIndex){const d=Math.sign(i-currentIndex);currentIndex=i;render(d);els.sliderBubble.hidden=false;}});els.pageSlider.addEventListener("change",()=>setTimeout(disengage,100));["pointerup","mouseup","touchend"].forEach(type=>window.addEventListener(type,disengage));
  document.addEventListener("keydown",e=>{if(e.target.matches("input,select,button"))return;if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();go(-1);}else if(e.key==="ArrowRight"||e.key==="PageDown"||e.key===" "){e.preventDefault();go(1);}else if(e.key==="Home"){e.preventDefault();currentIndex=0;render(-1);}else if(e.key==="End"){e.preventDefault();currentIndex=Math.max(0,filesFor(currentBook).length-1);render(1);}else if(e.key.toLowerCase()==="c"){setTocOpen(!document.body.classList.contains("toc-open"));}});
  els.pageStage.addEventListener("click",e=>{if(e.target===els.pageImage){const r=els.pageStage.getBoundingClientRect();go(e.clientX<r.left+r.width/2?-1:1);}});
  els.pageStage.addEventListener("wheel",e=>{if(e.ctrlKey){e.preventDefault();setImageZoom(imageZoom*Math.exp(-e.deltaY*.01));return;}const limits=panLimits(),canPanAtNormalSize=limits.maxX>0;if(imageZoom>1.001||canPanAtNormalSize){e.preventDefault();setImagePan(imagePanX-e.deltaX,imageZoom>1.001?imagePanY-e.deltaY:0);}},{passive:false});
  els.pageStage.addEventListener("dblclick",e=>{if(e.target===els.pageImage){e.preventDefault();setImageZoom(1);}});
  els.pageStage.addEventListener("gesturestart",e=>{e.preventDefault();gestureStartZoom=imageZoom;},{passive:false});
  els.pageStage.addEventListener("gesturechange",e=>{e.preventDefault();setImageZoom(gestureStartZoom*e.scale);},{passive:false});
  window.addEventListener("resize",()=>{fitImageToStage();fitBreadcrumb(activePathForIndex(currentIndex));});window.addEventListener("popstate",()=>{const p=new URLSearchParams(location.search),book=p.get("book");if(BOOK_ORDER.includes(book)){currentBook=book;els.bookSelect.value=book;currentIndex=indexForPrintedPage(book,p.get("page"));if(currentIndex<0)currentIndex=0;buildToc();render(0,{updateAddress:false});}});
  populateBooks();changeBook(currentBook,{useUrlPage:true});
})();
