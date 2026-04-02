import JSZip from 'jszip';

/**
 * Basic HWPX to Markdown converter.
 * HWPX is a ZIP file containing XMLs.
 * Main content is usually in Contents/section*.xml
 */
export async function convertHwpxToMarkdown(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  
  // Find all section files in Contents/
  const sectionFiles = Object.keys(zip.files).filter(name => 
    name.startsWith('Contents/section') && name.endsWith('.xml')
  ).sort((a, b) => {
    // Sort by section number: section0.xml, section1.xml, ...
    const numA = parseInt(a.match(/\d+/)?.at(0) || '0');
    const numB = parseInt(b.match(/\d+/)?.at(0) || '0');
    return numA - numB;
  });

  if (sectionFiles.length === 0) {
    throw new Error('No content sections found in HWPX file.');
  }

  let markdown = '';
  const parser = new DOMParser();

  for (const sectionPath of sectionFiles) {
    const content = await zip.files[sectionPath].async('string');
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    
    // HWPX uses namespaces. We'll look for paragraph tags.
    // Common tags: <hp:p> (paragraph), <hp:run> (text run), <hp:t> (text)
    const paragraphs = xmlDoc.getElementsByTagNameNS('*', 'p');
    
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      let pText = '';
      
      const runs = p.getElementsByTagNameNS('*', 'run');
      for (let j = 0; j < runs.length; j++) {
        const run = runs[j];
        const texts = run.getElementsByTagNameNS('*', 't');
        for (let k = 0; k < texts.length; k++) {
          pText += texts[k].textContent || '';
        }
      }
      
      if (pText.trim() || pText === '') {
        markdown += pText + '\n\n';
      }
    }
  }

  return markdown.trim();
}
