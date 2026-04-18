import React, { useState } from 'react';
import { CheckCircle2, FileText, ArrowRight, DollarSign, HardHat, Home, ShieldCheck, PenTool, Ruler, Printer, Loader2 } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';

const DESIGN_WORKFLOW_STEPS = [
  {
    id: 1,
    title: "Giai Đoạn 1: Khởi tạo & Ký kết",
    icon: <PenTool size={24} className="text-purple-600" />,
    tasks: ["Khảo sát sơ bộ", "Báo giá", "Ký kết hợp đồng", "Đo đạc nội nghiệp (chưa có tọa độ)"],
    documents: ["Phiếu khảo sát", "Báo giá thiết kế", "Hợp đồng thiết kế", "Bản vẽ đo đạc hiện trạng"]
  },
  {
    id: 2,
    title: "Giai Đoạn 2: Triển khai thiết kế",
    icon: <Ruler size={24} className="text-blue-600" />,
    tasks: ["Thống nhất phương án bố trí mặt bằng", "Xin phép xây dựng", "Thiết kế sơ bộ", "Giao hồ sơ thiết kế thi công"],
    documents: ["Bản vẽ mặt bằng phương án", "Hồ sơ xin phép xây dựng", "Hồ sơ thiết kế cơ sở", "Hồ sơ thiết kế bản vẽ thi công (đầy đủ)"]
  }
];

const WORKFLOW_STEPS = [
  {
    id: 1,
    title: "Báo giá & Hợp đồng",
    icon: <DollarSign size={24} className="text-sky-600" />,
    tasks: ["Khảo sát hiện trạng", "Xin phép xây dựng", "Thiết kế bản vẽ thi công", "Lập dự toán chi tiết", "Đàm phán điều khoản", "Ký kết hợp đồng"],
    documents: ["Bản vẽ thiết kế thi công", "Giấy phép xây dựng", "Báo giá thi công", "Hợp đồng kinh tế", "Phụ lục hợp đồng (nếu có)"]
  },
  {
    id: 2,
    title: "Chuẩn bị thi công",
    icon: <HardHat size={24} className="text-amber-600" />,
    tasks: ["Lập biện pháp thi công", "Tập kết vật tư & nhân công", "Lập kế hoạch tiến độ"],
    documents: ["Thuyết minh biện pháp thi công", "Kế hoạch Tiến độ thi công chi tiết", "Nhật ký công trình (bắt đầu)"]
  },
  {
    id: 3,
    title: "Thi công phần móng & ngầm",
    icon: <ArrowRight size={24} className="text-stone-600" />,
    tasks: ["Đào móng, ép cọc", "Gia công cốt thép, cốt pha", "Đổ bê tông móng, đà kiềng", "Thi công bể ngầm"],
    documents: ["Biên bản nghiệm thu vật liệu đầu vào", "Biên bản kiểm tra cốt thép - cốt pha", "Biên bản nghiệm thu công việc (móng)"]
  },
  {
    id: 4,
    title: "Thi công phần thân",
    icon: <Home size={24} className="text-indigo-600" />,
    tasks: ["Đổ bê tông cột", "Xây tường bao, tường ngăn", "Gia công & đổ bê tông sàn", "Lắp đặt ống chờ điện nước", "Báo cáo giám sát"],
    documents: ["Biên bản nghiệm thu vật liệu", "Biên bản kiểm tra cốt thép - cốt pha (cột, sàn)", "Biên bản nghiệm thu công việc (xây tường, bê tông)", "Báo cáo Giám sát tuần"]
  },
  {
    id: 5,
    title: "Thi công hoàn thiện",
    icon: <CheckCircle2 size={24} className="text-teal-600" />,
    tasks: ["Trát tường, cán nền", "Ốp lát gạch, đá", "Sơn bả, đóng trần thạch cao", "Lắp đặt thiết bị vệ sinh, đèn"],
    documents: ["Biên bản nghiệm thu công việc (trát, ốp lát)", "Biên bản nghiệm thu lắp đặt thiết bị", "Biên bản xác nhận khối lượng phát sinh (nếu có)"]
  },
  {
    id: 6,
    title: "Nghiệm thu & Bàn giao",
    icon: <ShieldCheck size={24} className="text-emerald-600" />,
    tasks: ["Vệ sinh công nghiệp", "Kiểm tra vận hành hệ thống", "Nghiệm thu tổng thể", "Bàn giao chìa khóa"],
    documents: ["Thuyết minh Bản vẽ Hoàn công", "Biên bản bàn giao công trình đưa vào sử dụng", "Phiếu bảo hành công trình"]
  }
];

export const WorkflowView = ({ onDocumentClick }: { onDocumentClick?: (docName: string) => void }) => {
  const [activeTab, setActiveTab] = useState<'construction' | 'design'>('construction');
  const [isExporting, setIsExporting] = useState(false);

  const currentSteps = activeTab === 'construction' ? WORKFLOW_STEPS : DESIGN_WORKFLOW_STEPS;

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('workflow-content');
    
    if (!element) {
      setIsExporting(false);
      return;
    }

    try {
      const imgData = await htmlToImage.toJpeg(element, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        filter: (node) => {
          if (node.classList && node.classList.contains('no-print')) {
            return false;
          }
          return true;
        }
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Quy_trinh_${activeTab === 'construction' ? 'Thi_cong' : 'Thiet_ke'}.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
      window.print(); // Fallback
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div id="workflow-content" className="max-w-5xl mx-auto animate-in fade-in duration-500 bg-white p-4 md:p-8 rounded-2xl">
      <div className="mb-10 text-center relative">
        <div className="flex justify-end mb-4 md:mb-0 md:absolute md:top-0 md:right-0 no-print">
          <button 
            onClick={handleDownloadPDF} 
            disabled={isExporting}
            className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-sky-700 transition-all shadow-md disabled:bg-slate-400"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>} 
            {isExporting ? "Đang xử lý..." : "Tải PDF"}
          </button>
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight uppercase mb-4">Quy trình thực hiện dự án</h2>
        <p className="text-slate-500 max-w-2xl mx-auto mb-8">Tổng quan các bước thực hiện từ khi báo giá đến lúc bàn giao công trình, kèm theo danh mục hồ sơ quản lý chất lượng cần thiết cho từng giai đoạn.</p>
        
        <div className="inline-flex flex-wrap justify-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 no-print">
          <button 
            onClick={() => setActiveTab('construction')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'construction' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Quy trình Thi công
          </button>
          <button 
            onClick={() => setActiveTab('design')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'design' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Quy trình Thiết kế
          </button>
        </div>
      </div>

      <div className="relative border-l-2 border-slate-200 ml-4 md:ml-8 space-y-12 pb-12">
        {currentSteps.map((step, index) => (
          <div key={step.id} className="relative pl-8 md:pl-12">
            {/* Timeline dot */}
            <div className="absolute -left-[21px] top-1 w-10 h-10 rounded-full bg-white border-4 border-slate-100 flex items-center justify-center shadow-sm">
              {step.icon}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <span className="text-4xl font-black text-slate-100">{step.id.toString().padStart(2, '0')}</span>
                <h3 className="text-xl font-bold text-slate-800 uppercase">{step.title}</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Tasks */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CheckCircle2 size={14} /> Các công tác chính
                  </h4>
                  <ul className="space-y-3">
                    {step.tasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0"></div>
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Documents */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileText size={14} /> Hồ sơ quản lý chất lượng
                  </h4>
                  <ul className="space-y-3">
                    {step.documents.map((doc, i) => (
                      <li 
                        key={i} 
                        onClick={() => onDocumentClick && onDocumentClick(doc)}
                        className={`flex items-start gap-2 text-sm font-medium transition-colors ${onDocumentClick ? 'cursor-pointer text-sky-700 hover:text-sky-900 hover:bg-sky-100 p-2 -mx-2 rounded-lg' : 'text-slate-700'}`}
                        title={onDocumentClick ? "Nhấn để tạo văn bản này" : ""}
                      >
                        <FileText size={16} className="text-sky-600 shrink-0 mt-0.5" />
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
