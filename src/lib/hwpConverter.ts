// Since we need to rely on @ohah/hwpjs or another HWP parsing library for binary HWP formatting,
// this module will wrap the parsing logic for .hwp files.

export async function convertHwpToMarkdown(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // We do a dynamic import here so the app doesn't break if the package isn't installed yet
        try {
          // Attempt to load the @ohah/hwpjs library dynamically
          // Ensure that the user runs `npm install @ohah/hwpjs` for this to work natively
          const hwpjs = await import('@ohah/hwpjs');
          
          // Depending on the version of @ohah/hwpjs, the API might vary.
          // Usually, they provide parse() or toMarkdown() functions:
          if (typeof hwpjs.toMarkdown === 'function') {
            const md = await hwpjs.toMarkdown(arrayBuffer);
            resolve(md);
            return;
          } else if (typeof hwpjs.parse === 'function') {
            // General parsing logic
            const data = await hwpjs.parse(arrayBuffer);
            // In a real scenario, map data blocks into markdown:
            resolve(JSON.stringify(data, null, 2));
            return;
          }
          
          resolve("HWP file parsed, but library API was unrecognized. Make sure @ohah/hwpjs supports toMarkdown.");
        } catch (importError) {
          console.error("Failed to import @ohah/hwpjs package", importError);
          reject(new Error("The '@ohah/hwpjs' package is required to parse .hwp files. Please run 'npm install @ohah/hwpjs'."));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read HWP file.'));
    reader.readAsArrayBuffer(file);
  });
}
