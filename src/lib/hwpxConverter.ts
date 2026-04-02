import JSZip from 'jszip';

export async function convertHwpxToMarkdown(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  
  // 1. Read header.xml to find bold charPr IDs
  interface CharStyle {
    bold: boolean;
    fontSizePt: number;
  }
  const charStyles = new Map<string, CharStyle>();

  try {
    const headerEntry = Object.keys(zip.files).find(name => name.endsWith('header.xml'));
    if (headerEntry) {
      const headerContent = await zip.files[headerEntry].async('string');
      const parser = new DOMParser();
      const headerDoc = parser.parseFromString(headerContent, 'text/xml');
      
      const charPrs = headerDoc.getElementsByTagNameNS('*', 'charPr');
      for (let i = 0; i < charPrs.length; i++) {
        const pr = charPrs[i];
        const id = pr.getAttribute('id');
        if (!id) continue;

        let isBold = pr.getAttribute('bold') === '1' || pr.getAttribute('bold') === 'true';
        if (!isBold) {
           const boldElem = pr.getElementsByTagNameNS('*', 'bold')[0];
           if (boldElem && (boldElem.textContent === 'true' || boldElem.textContent === '1')) {
               isBold = true;
           }
        }
        if (!isBold) {
             const xmlStr = new XMLSerializer().serializeToString(pr).toLowerCase();
             if (xmlStr.includes('bold="1"') || xmlStr.includes('bold="true"')) {
                 isBold = true;
             }
        }

        let heightPt = 10;
        const heightAttr = pr.getAttribute('height');
        if (heightAttr) {
          heightPt = parseInt(heightAttr) / 100;
        }
        
        charStyles.set(id, { bold: isBold, fontSizePt: heightPt });
      }
    }
  } catch (e) {
    console.warn('Failed to parse header.xml for styles', e);
  }

  // 2. Find all section files in Contents/
  const sectionFiles = Object.keys(zip.files).filter(name => 
    name.startsWith('Contents/section') && name.endsWith('.xml')
  ).sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.at(0) || '0');
    const numB = parseInt(b.match(/\d+/)?.at(0) || '0');
    return numA - numB;
  });

  if (sectionFiles.length === 0) {
    throw new Error('No content sections found in HWPX file.');
  }

  let markdown = '';
  const parser = new DOMParser();

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
       let txt = '';
       for (let i = 0; i < node.childNodes.length; i++) {
           txt += processNode(node.childNodes[i]);
       }
       return txt;
    }

    const el = node as Element;
    const nodeName = el.localName || el.nodeName;

    // Table
    if (nodeName === 'tbl') {
      let tblHtml = '\n<table border="1">\n';
      const rows = Array.from(el.childNodes).filter(n => (n as Element).localName === 'tr');
      rows.forEach(tr => {
        tblHtml += '  <tr>\n';
        const cells = Array.from(tr.childNodes).filter(n => (n as Element).localName === 'tc');
        cells.forEach(tc => {
          const cellEl = tc as Element;
          const colSpan = cellEl.getAttribute('colSpan') || cellEl.getAttribute('colspan') || '1';
          const rowSpan = cellEl.getAttribute('rowSpan') || cellEl.getAttribute('rowspan') || '1';
          
          let attrs = '';
          if (colSpan !== '1') attrs += ` colspan="${colSpan}"`;
          if (rowSpan !== '1') attrs += ` rowspan="${rowSpan}"`;
          
          let cellContent = processNode(tc).trim();
          // Convert internal newlines to <br> for HTML rendering
          cellContent = cellContent.replace(/\n\n/g, '<br/>').replace(/\n/g, '<br/>');
          
          tblHtml += `    <td${attrs}>${cellContent}</td>\n`;
        });
        tblHtml += '  </tr>\n';
      });
      tblHtml += '</table>\n\n';
      return tblHtml;
    }

    // Paragraph
    if (nodeName === 'p') {
      let pText = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        pText += processNode(el.childNodes[i]);
      }
      return pText + '\n\n';
    }

    // Line segments inside paragraph
    if (nodeName === 'lineseg') {
        let segText = '';
        for (let i = 0; i < el.childNodes.length; i++) {
            segText += processNode(el.childNodes[i]);
        }
        return segText + '\n';
    }

    // Run (text span with same style)
    if (nodeName === 'run') {
      const charPrIDRef = el.getAttribute('charPrIDRef');
      const style = charPrIDRef ? charStyles.get(charPrIDRef) : null;
      
      let runText = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        runText += processNode(el.childNodes[i]);
      }
      
      if (!runText.trim()) return runText;

      const leadingSpaces = runText.match(/^\s*/)?.[0] || '';
      const trailingSpaces = runText.match(/\s*$/)?.[0] || '';
      let coreText = runText.trim();
      
      if (style?.bold) {
        coreText = `**${coreText}**`;
      }
      if (style && style.fontSizePt && style.fontSizePt !== 10) {
        coreText = `<span style="font-size: ${style.fontSizePt}pt">${coreText}</span>`;
      }
      
      return `${leadingSpaces}${coreText}${trailingSpaces}`;
    }
    
    // Text item
    if (nodeName === 't') {
      return el.textContent || '';
    }
    
    // Default fallback
    let text = '';
    for (let i = 0; i < el.childNodes.length; i++) {
      text += processNode(el.childNodes[i]);
    }
    return text;
  }

  for (const sectionPath of sectionFiles) {
    const content = await zip.files[sectionPath].async('string');
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    
    if (xmlDoc.documentElement) {
       for (let i = 0; i < xmlDoc.documentElement.childNodes.length; i++) {
           markdown += processNode(xmlDoc.documentElement.childNodes[i]);
       }
    }
  }

  // clean up excessive newlines
  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}
