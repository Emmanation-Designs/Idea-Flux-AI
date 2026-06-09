import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import * as XLSX from 'xlsx';
import { FileText, Table as TableIcon, Check, FileSpreadsheet, Download, Loader2, RefreshCw, AlertTriangle, File, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';

interface DocumentExportCardProps {
  jsonData: string;
  isPro?: boolean;
}

export const DocumentExportCard: React.FC<DocumentExportCardProps> = ({ jsonData, isPro = false }) => {
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [parseError, setParseError] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<string>("preview"); // "preview" | "raw"
  const [showFullOutline, setShowFullOutline] = useState<boolean>(false);

  // Lazy parse the data safely
  React.useEffect(() => {
    try {
      // Find JSON bounds in case LLM added extra markdown text around it
      let jsonStr = jsonData.trim();
      const firstCurly = jsonStr.indexOf('{');
      const lastCurly = jsonStr.lastIndexOf('}');
      if (firstCurly !== -1 && lastCurly !== -1) {
        jsonStr = jsonStr.substring(firstCurly, lastCurly + 1);
      }
      const data = JSON.parse(jsonStr);
      setParsedData(data);
      setParseError(false);
    } catch (e) {
      console.error("Failed to parse JSON file data:", e);
      setParseError(true);
    }
  }, [jsonData]);

  if (parseError) {
    return (
      <div className="my-6 p-5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4 max-w-full">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Document Blueprint Format Warning</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
            The AI drafted a document structure, but there is a formatting issue in the raw code blueprint. You can ask Trelvix to regenerate it.
          </p>
        </div>
      </div>
    );
  }

  if (!parsedData) {
    return (
      <div className="my-6 p-6 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl flex items-center justify-center gap-3">
        <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
        <span className="text-xs text-zinc-400 font-medium">Loading document export panel...</span>
      </div>
    );
  }

  const { fileType = "pdf", fileName = "trelvix-export", title = "Trelvix AI Document", subtitle, author = "Trelvix AI", sections = [] } = parsedData;

  const getCleanFilename = (ext: string) => {
    const clean = fileName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-_]/gi, '')
      .replace(/\s+/g, '_');
    return `${clean || 'trelvix-file'}.${ext}`;
  };

  // Safe metrics calculator
  const getMetrics = () => {
    let wordCount = 0;
    let tableCount = 0;
    let listItemsCount = 0;

    sections.forEach((sec: any) => {
      if (sec.type === 'table') tableCount++;
      if (sec.type === 'bullet' && Array.isArray(sec.bullets)) listItemsCount += sec.bullets.length;
      
      if (sec.heading) wordCount += sec.heading.split(/\s+/).length;
      if (Array.isArray(sec.paragraphs)) {
        sec.paragraphs.forEach((p: string) => {
          wordCount += p.split(/\s+/).length;
        });
      }
      if (Array.isArray(sec.bullets)) {
        sec.bullets.forEach((b: string) => {
          wordCount += b.split(/\s+/).length;
        });
      }
    });

    return { words: wordCount, tables: tableCount, items: listItemsCount };
  };

  const metrics = getMetrics();

  // 1. PDF Export logic
  const handleExportPDF = async () => {
    setIsGenerating("pdf");
    toast.info("Assembling PDF typography and sections...");

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      // Primary tracking page footer
      const drawPageFooter = () => {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          
          doc.setDrawColor(243, 244, 246);
          doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

          if (!isPro) {
            doc.setFont("Helvetica", "oblique");
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text("Generated by Trelvix AI Document Engine", margin, pageHeight - 10);
          }
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(156, 163, 175);
          doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 10);
        }
      };

      const checkPageOverflow = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin - 15) {
          doc.addPage();
          y = margin;
          
          doc.setFillColor(16, 185, 129);
          doc.rect(margin, y, 4, 4, "F");
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(107, 114, 128);
          doc.text(title.toUpperCase().substring(0, 31) + " | Continued", margin + 7, y + 3.5);
          y += 12;
        }
      };

      const drawParagraph = (text: string, fontSize = 10, fontStyle = 'normal') => {
        doc.setFont("Helvetica", fontStyle);
        doc.setFontSize(fontSize);
        doc.setTextColor(75, 85, 99);
        const lines = doc.splitTextToSize(text, contentWidth);
        const height = lines.length * (fontSize * 0.45) + 3;
        checkPageOverflow(height);
        doc.text(lines, margin, y);
        y += height;
      };

      // Top Header Line Tint
      doc.setFillColor(16, 185, 129);
      doc.rect(margin, y, contentWidth, 3.5, "F");
      y += 11;

      // Main title banner
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(17, 24, 39);
      const titleLines = doc.splitTextToSize(title, contentWidth);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 9.5 + 2;

      if (subtitle || author) {
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(107, 114, 128);
        const subtitleStr = [subtitle, author ? `By: ${author}` : ''].filter(Boolean).join("  •  ");
        doc.text(subtitleStr, margin, y);
        y += 8;
      }

      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 12;

      if (sections && Array.isArray(sections)) {
        sections.forEach((section: any) => {
          if (section.heading) {
            checkPageOverflow(16);
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(17, 24, 39);
            doc.text(section.heading, margin, y);
            y += 6;

            doc.setDrawColor(16, 185, 129);
            doc.setLineWidth(0.75);
            doc.line(margin, y, margin + 20, y);
            y += 8;
          }

          if (section.type === "bullet" && Array.isArray(section.bullets)) {
            section.bullets.forEach((bullet: string) => {
              checkPageOverflow(7.5);
              doc.setFont("Helvetica", "normal");
              doc.setFontSize(10.5);
              doc.setTextColor(55, 65, 81);
              
              doc.setFillColor(156, 163, 175);
              doc.circle(margin + 2, y - 3, 1, "F");

              const bulletLines = doc.splitTextToSize(bullet, contentWidth - 8);
              doc.text(bulletLines, margin + 7, y);
              y += bulletLines.length * 5 + 2.5;
            });
            y += 4;
          } else if (section.type === "table" && Array.isArray(section.headers) && Array.isArray(section.rows)) {
            const headers = section.headers;
            const rows = section.rows;
            const colWidth = contentWidth / headers.length;
            const rHeight = 8.5;

            checkPageOverflow(rHeight + 5);
            doc.setFillColor(55, 65, 81);

            doc.setFont("Helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.setDrawColor(209, 213, 219);
            doc.setLineWidth(0.25);

            headers.forEach((hdr: string, i: number) => {
              const cellX = margin + i * colWidth;
              const safeText = hdr.length > 20 ? hdr.substring(0, 18) + ".." : hdr;
              doc.text(safeText, cellX + 3.5, y + 5.5);
              doc.line(cellX, y, cellX, y + rHeight);
            });
            doc.line(margin + contentWidth, y, margin + contentWidth, y + rHeight);
            doc.line(margin, y, margin + contentWidth, y);
            doc.line(margin, y + rHeight, margin + contentWidth, y + rHeight);
            y += rHeight;

            rows.forEach((rowArr: any[], rIdx: number) => {
              checkPageOverflow(rHeight + 2);
              if (rIdx % 2 === 1) {
                doc.setFillColor(249, 250, 251);
                doc.rect(margin, y, contentWidth, rHeight, "F");
              }

              doc.setFont("Helvetica", "normal");
              doc.setFontSize(8.5);
              doc.setTextColor(75, 85, 99);

              rowArr.forEach((cellVal: any, cIdx: number) => {
                const cellX = margin + cIdx * colWidth;
                const cellStr = String(cellVal ?? "");
                const safeValText = cellStr.length > 25 ? cellStr.substring(0, 22) + "..." : cellStr;
                doc.text(safeValText, cellX + 3.5, y + 5.5);
                doc.line(cellX, y, cellX, y + rHeight);
              });
              doc.line(margin + contentWidth, y, margin + contentWidth, y + rHeight);
              doc.line(margin, y + rHeight, margin + contentWidth, y + rHeight);
              y += rHeight;
            });
            y += 8;
          } else if (Array.isArray(section.paragraphs)) {
            section.paragraphs.forEach((p: string) => {
              drawParagraph(p, 10.5, 'normal');
            });
            y += 4;
          }
        });
      }

      drawPageFooter();

      const pdfBlob = doc.output('blob');
      saveAs(pdfBlob, getCleanFilename("pdf"));
      toast.success("PDF generated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to compile PDF document.");
    } finally {
      setIsGenerating(null);
    }
  };

  // 2. DOCX Word Export logic
  const handleExportDOCX = async () => {
    setIsGenerating("docx");
    toast.info("Drafting Word document structure...");

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const docChildren: any[] = [];

      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          spacing: { after: 150, before: 100 },
          children: [
            new TextRun({
              text: title,
              bold: true,
              size: 34,
              color: "1F2937",
              font: "Arial",
            }),
          ],
        })
      );

      if (subtitle || author) {
        const subStr = [subtitle, author ? `Author: ${author}` : ''].filter(Boolean).join("  |  ");
        docChildren.push(
          new Paragraph({
            spacing: { after: 250 },
            children: [
              new TextRun({
                text: subStr,
                italics: true,
                size: 19,
                color: "6B7280",
                font: "Arial",
              }),
            ],
          })
        );
      }

      docChildren.push(new Paragraph({ spacing: { after: 150 } }));

      if (sections && Array.isArray(sections)) {
        sections.forEach((section: any) => {
          if (section.heading) {
            docChildren.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
                children: [
                  new TextRun({
                    text: section.heading,
                    bold: true,
                    size: 26,
                    color: "10B981",
                    font: "Arial",
                  }),
                ],
              })
            );
          }

          if (section.type === "bullet" && Array.isArray(section.bullets)) {
            section.bullets.forEach((bulletItem: string) => {
              docChildren.push(
                new Paragraph({
                  bullet: { level: 0 },
                  spacing: { after: 60 },
                  children: [
                    new TextRun({
                      text: bulletItem,
                      size: 21,
                      color: "374151",
                      font: "Arial",
                    }),
                  ],
                })
              );
            });
            docChildren.push(new Paragraph({ spacing: { after: 60 } }));
          } else if (section.type === "table" && Array.isArray(section.headers) && Array.isArray(section.rows)) {
            const headers = section.headers;
            const rows = section.rows;
            const tWidth = 100 / headers.length;

            const tableRows = [
              new TableRow({
                children: headers.map((hdrStr: string) => (
                  new TableCell({
                    width: { size: tWidth, type: WidthType.PERCENTAGE },
                    shading: { fill: "374151", color: "auto" },
                    margins: { top: 120, bottom: 120, left: 160, right: 160 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: hdrStr,
                            bold: true,
                            size: 19,
                            color: "FFFFFF",
                            font: "Arial",
                          }),
                        ],
                      }),
                    ],
                  })
                )),
              }),

              ...rows.map((rowArr: any[], rId: number) => (
                new TableRow({
                  children: rowArr.map((cellObj: any) => (
                    new TableCell({
                      width: { size: tWidth, type: WidthType.PERCENTAGE },
                      shading: rId % 2 === 1 ? { fill: "F9FAFB", color: "auto" } : undefined,
                      margins: { top: 110, bottom: 110, left: 160, right: 160 },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: String(cellObj ?? ""),
                              size: 19,
                              color: "4B5563",
                              font: "Arial",
                            }),
                          ],
                        }),
                      ],
                    })
                  )),
                })
              )),
            ];

            docChildren.push(
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                margins: { top: 120, bottom: 120, left: 160, right: 160 },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
                  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
                  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
                },
                rows: tableRows,
              })
            );

            docChildren.push(new Paragraph({ spacing: { after: 120 } }));
          } else if (Array.isArray(section.paragraphs)) {
            section.paragraphs.forEach((pStr: string) => {
              docChildren.push(
                new Paragraph({
                  spacing: { after: 150 },
                  children: [
                    new TextRun({
                      text: pStr,
                      size: 21,
                      color: "374151",
                      font: "Arial",
                    }),
                  ],
                })
              );
            });
            docChildren.push(new Paragraph({ spacing: { after: 50 } }));
          }
        });
      }

      const wordDocument = new Document({
        sections: [{
          properties: {},
          children: docChildren,
        }],
      });

      const blobOut = await Packer.toBlob(wordDocument);
      saveAs(blobOut, getCleanFilename("docx"));

      toast.success("Word Document exported successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to construct Microsoft Word document.");
    } finally {
      setIsGenerating(null);
    }
  };

  // 3. XLSX Excel Spreadsheet Export logic
  const handleExportXLSX = async () => {
    setIsGenerating("xlsx");
    toast.info("Generating spreadsheet cells and worksheets...");

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const workbook = XLSX.utils.book_new();
      let addedWorksheet = false;

      if (parsedData.spreadsheet && Array.isArray(parsedData.spreadsheet.sheets)) {
        parsedData.spreadsheet.sheets.forEach((sheet: any) => {
          if (sheet.name && Array.isArray(sheet.rows)) {
            const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.substring(0, 31));
            addedWorksheet = true;
          }
        });
      }

      if (sections && Array.isArray(sections)) {
        sections.forEach((section: any, id: number) => {
          if (section.type === "table" && Array.isArray(section.headers) && Array.isArray(section.rows)) {
            const gridData = [section.headers, ...section.rows];
            const worksheet = XLSX.utils.aoa_to_sheet(gridData);
            const sheetTitle = (section.heading || `Table ${id + 1}`).substring(0, 31);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
            addedWorksheet = true;
          }
        });
      }

      if (!addedWorksheet) {
        const flatContent: any[][] = [
          [title],
          [subtitle || ""],
          ["Author", author],
          [""],
          ["DOCUMENT STRUCTURAL SECTION LOGS"],
        ];

        if (sections && Array.isArray(sections)) {
          sections.forEach((sec: any) => {
            if (sec.heading) {
              flatContent.push([""]);
              flatContent.push([sec.heading.toUpperCase()]);
            }
            if (sec.type === "bullet" && Array.isArray(sec.bullets)) {
              sec.bullets.forEach((bulletStr: string) => {
                flatContent.push([`• ${bulletStr}`]);
              });
            } else if (Array.isArray(sec.paragraphs)) {
              sec.paragraphs.forEach((pStr: string) => {
                flatContent.push([pStr]);
              });
            }
          });
        }

        const fallbackWorksheet = XLSX.utils.aoa_to_sheet(flatContent);
        XLSX.utils.book_append_sheet(workbook, fallbackWorksheet, "Export Overview");
      }

      const writeBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([writeBuffer], { type: 'application/octet-stream' });
      saveAs(excelBlob, getCleanFilename("xlsx"));
      toast.success("Excel spreadsheet exported successfully!");
    } catch (exc) {
      console.error(exc);
      toast.error("Failed to construct Excel workbook.");
    } finally {
      setIsGenerating(null);
    }
  };

  const reqType = String(fileType || '').toLowerCase().trim();
  const hasSpreadsheetData = parsedData.spreadsheet || sections?.some((s: any) => s.type === 'table');
  
  const showExcel = reqType === "xlsx" || reqType === "excel" || reqType === "spreadsheet" || (reqType === "" && hasSpreadsheetData);
  const showWord = reqType === "docx" || reqType === "doc" || reqType === "word";
  const showPDF = reqType === "pdf" || (!showExcel && !showWord);

  const primaryFormat = showExcel ? "xlsx" : (showWord ? "docx" : "pdf");

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="my-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4.5 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-300 max-w-full w-full"
    >
      <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
        <div className="text-zinc-400 dark:text-zinc-500 shrink-0">
          {showExcel ? (
            <FileSpreadsheet className="w-5 h-5" strokeWidth={1.2} />
          ) : showWord ? (
            <FileText className="w-5 h-5" strokeWidth={1.2} />
          ) : (
            <File className="w-5 h-5" strokeWidth={1.2} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h5 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-snug">
            {title}
          </h5>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
            <span className="uppercase font-bold text-zinc-600 dark:text-zinc-300">{primaryFormat}</span>
            <span>•</span>
            <span>{metrics.words} words</span>
            {sections?.length > 0 && (
              <>
                <span>•</span>
                <span>{sections.length} parts</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
        <button
          onClick={showExcel ? handleExportXLSX : showWord ? handleExportDOCX : handleExportPDF}
          disabled={isGenerating !== null}
          className="py-1.5 px-3.5 rounded-lg flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.2} />
              <span>Compiling...</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" strokeWidth={1.2} />
              <span>Download</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
