import { useState, ChangeEvent } from 'react';
import { Upload, FileText, Download, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { convertHwpxToMarkdown } from './lib/hwpxConverter';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [markdown, setMarkdown] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.toLowerCase().endsWith('.hwpx')) {
        setFile(selectedFile);
        setError(null);
        setMarkdown('');
      } else {
        setError('Please select a valid .hwpx file.');
        setFile(null);
      }
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    try {
      const result = await convertHwpxToMarkdown(file);
      setMarkdown(result);
    } catch (err) {
      console.error(err);
      setError('Failed to convert file. It might be corrupted or an unsupported version.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadMarkdown = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file?.name.replace(/\.hwpx$/i, '.md') || 'converted.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-200"
          >
            <FileText className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold tracking-tight text-slate-900 mb-3"
          >
            HWPX to Markdown
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-600"
          >
            Convert your Hangul Word Processor files to clean Markdown instantly.
          </motion.p>
        </header>

        <main className="space-y-8">
          <section>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="p-8">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-12 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative group">
                  <input
                    type="file"
                    accept=".hwpx"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="w-12 h-12 text-slate-400 mb-4 group-hover:text-blue-500 transition-colors" />
                  <p className="text-lg font-medium text-slate-700">
                    {file ? file.name : "Click or drag .hwpx file here"}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Maximum file size: 50MB
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100"
                    >
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-medium">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-8 flex justify-center">
                  <button
                    onClick={processFile}
                    disabled={!file || isProcessing}
                    className={`
                      px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center gap-2
                      ${!file || isProcessing 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 active:scale-95'}
                    `}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        Convert to Markdown
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </section>

          <AnimatePresence>
            {markdown && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                    Conversion Result
                  </h2>
                  <button
                    onClick={downloadMarkdown}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download .md
                  </button>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-1 bg-slate-50 border-b border-slate-200 flex items-center px-4 py-2">
                    <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Markdown Preview</span>
                  </div>
                  <div className="p-6 max-h-[500px] overflow-y-auto font-mono text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {markdown}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-20 text-center text-slate-400 text-sm">
          <p>© {new Date().getFullYear()} HWPX to Markdown Converter</p>
          <p className="mt-1">Private & Secure: All processing happens in your browser.</p>
        </footer>
      </div>
    </div>
  );
}
