import JSZip from 'jszip';

export async function convertHwpxToMarkdown(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  
  // 1. Read header.xml to find bold charPr IDs
  const boldCharPrIds = new Set<string>();
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
        
        if (isBold) {
          boldCharPrIds.add(id);
        }
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
      let tblText = '\n';
      const rows = Array.from(el.childNodes).filter(n => (n as Element).localName === 'tr');
      rows.forEach((tr, index) => {
        const cells = Array.from(tr.childNodes).filter(n => (n as Element).localName === 'tc');
        tblText += '| ' + cells.map(c => processNode(c).trim().replace(/\n+/g, '<br>')).join(' | ') + ' |\n';
        if (index === 0) {
          tblText += '|' + cells.map(() => '---').join('|') + '|\n';
        }
      });
      return tblText + '\n';
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
      const isBold = charPrIDRef && boldCharPrIds.has(charPrIDRef);
      
      let runText = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        runText += processNode(el.childNodes[i]);
      }
      
      if (isBold && runText.trim()) {
        const leadingSpaces = runText.match(/^\s*/)?.[0] || '';
        const trailingSpaces = runText.match(/\s*$/)?.[0] || '';
        return `${leadingSpaces}**${runText.trim()}**${trailingSpaces}`;
      }
      return runText;
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
