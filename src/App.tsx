import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Loader2, ArrowLeft, MapPin, Home as HomeIcon,         
  DollarSign, Printer, ChevronRight, ClipboardList, ShieldCheck, 
  HardHat, Construction, Info, CheckSquare, Download, Image as ImageIcon,
  Stamp, Briefcase, Ruler, PenTool, AlertCircle, ChevronDown, ChevronUp,
  Camera, FileDown, Upload, TrendingUp, Scale
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { WorkflowView } from './components/WorkflowView';
import { MarketPrices } from './components/MarketPrices';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- CONFIGURATION ---
const getAIClient = () => {
    const key = process.env.API_KEY || process.env.GEMINI_API_KEY;
    return new GoogleGenAI({ apiKey: key });
};

const CATEGORIES = [
  { 
    id: 'pricing', 
    label: 'Báo giá & Dự toán', 
    icon: DollarSign, 
    types: [
        "Báo giá Thi công Trọn gói (Chìa khóa trao tay)", 
        "Báo giá Thi công Phần thô & Nhân công", 
        "Báo giá Sửa chữa & Cải tạo",
        "Dự toán Chi tiết Hạng mục Nội thất"
    ] 
  },
  { 
    id: 'contract', 
    label: 'Hợp đồng & Pháp lý', 
    icon: FileText, 
    types: [
        "Hợp đồng Kinh tế Thi công Xây dựng", 
        "Hợp đồng Nhân công khoán gọn", 
        "Hợp đồng Tư vấn Thiết kế Kiến trúc",
        "Hợp đồng Thi công Nội thất",
        "Hợp đồng Mua bán vật tư, thiết bị",
        "Hợp đồng Giao khoán thầu phụ (Trọn gói nhân công & vật tư)",
        "Hợp đồng Giao khoán thầu phụ (Chỉ nhân công)",
        "Phụ lục Hợp đồng điều chỉnh khối lượng", 
        "Biên bản Thanh lý Hợp đồng"
    ] 
  }
];

const VIETNAM_PROVINCES = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Bình Dương", "Đồng Nai", "Long An", "Bà Rịa - Vũng Tàu", "Khác"];
const BUILDING_TYPES = ["Nhà phố", "Biệt thự", "Nhà cấp 4", "Căn hộ chung cư", "Văn phòng", "Khác"];

// --- UTILS ---
const cleanContentFromAI = (text: string) => {
    if (!text) return "";
    const patternsToRemove = [
        /Cộng hòa Xã hội Chủ nghĩa Việt Nam/gi,
        /Độc lập - Tự do - Hạnh phúc/gi,
        /^\s*---\s*$/gm // Only remove horizontal rules, not table syntax
    ];
    let cleaned = text;
    patternsToRemove.forEach(p => { cleaned = cleaned.replace(p, ''); });
    return cleaned.trim();
};

const downloadTxtFile = (title: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

// --- COMPONENTS & TEMPLATES ---

const PriceQuoteTemplate = React.forwardRef(({ data }: {data: any}, ref: any) => {
    const basicArea = Number(data.area) || 0;
    const floors = Number(data.floors) || 1;
    const mongArea = basicArea * 0.5; 
    const thanArea = basicArea * floors;
    const maiArea = basicArea * 0.5;
    const totalArea = mongArea + thanArea + maiArea;
    
    // Sử dụng đơn giá từ AI trích xuất (nếu có), nếu không dùng mặc định
    const unitPriceTho = data.unitPrice || (data.title?.includes("Thô") ? 3850000 : 7000000);
    const totalCost = totalArea * unitPriceTho;

    return (
        <div ref={ref} className="print-area bg-slate-100 p-4 md:p-8 overflow-x-auto">
            {/* Trang 1: Báo giá tổng quát */}
            <div id="capture-page-1" className="pdf-page bg-white mx-auto p-[15mm] w-[210mm] min-h-[297mm] font-sans text-slate-800 shadow-sm mb-10 overflow-hidden relative border border-slate-200">
                <div className="flex justify-between items-start mb-10 border-b-2 border-sky-800 pb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#0c4a6e] p-3 rounded-lg text-white font-black text-2xl">PX</div>
                        <div>
                            <h2 className="text-xl font-black uppercase text-[#0c4a6e]">PHỐ XANH AI</h2>
                            <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em]">CÔNG NGHỆ XÂY DỰNG SỐ</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">BÁO GIÁ</h1>
                        <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-widest">PX-{Date.now().toString().slice(-6)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="border-l-4 border-sky-600 pl-5 py-2">
                        <h3 className="text-[11px] font-bold text-sky-700 uppercase mb-3">Thông tin dự án</h3>
                        <div className="space-y-1.5 text-[13px]">
                            <p><span className="text-slate-500">Loại:</span> <span className="font-bold">{data.title}</span></p>
                            <p><span className="text-slate-500">Công trình:</span> <span className="font-bold">{data.buildingType || 'Nhà phố'}</span></p>
                            <p><span className="text-slate-500">Vị trí:</span> <span className="font-bold">{data.location}</span></p>
                            <p><span className="text-slate-500">Quy mô:</span> <span className="font-bold">{data.area}m² | {data.floors} Tầng</span></p>
                        </div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-right">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-1">Dự toán tổng cộng</h3>
                        <p className="text-3xl font-black text-[#0c4a6e]">{totalCost.toLocaleString('vi-VN')} <span className="text-sm font-normal">VNĐ</span></p>
                    </div>
                </div>

                <div className="mb-8">
                    <h4 className="text-[14px] font-bold uppercase text-slate-900 mb-4 border-b pb-2">1. Chi tiết diện tích thi công</h4>
                    <table className="w-full text-[12px] border-collapse">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="p-3 text-left border border-slate-300">Hạng mục</th>
                                <th className="p-3 text-center border border-slate-300">Cách tính</th>
                                <th className="p-3 text-right border border-slate-300">Diện tích (m²)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-3 border border-slate-300">Phần móng (Hệ số 50%)</td>
                                <td className="p-3 text-center border border-slate-300">{basicArea} x 0.5</td>
                                <td className="p-3 text-right border border-slate-300 font-bold">{mongArea.toFixed(1)}</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-300">Phần thân (100%)</td>
                                <td className="p-3 text-center border border-slate-300">{basicArea} x {floors}</td>
                                <td className="p-3 text-right border border-slate-300 font-bold">{thanArea.toFixed(1)}</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-300">Phần mái (Hệ số 50%)</td>
                                <td className="p-3 text-center border border-slate-300">{basicArea} x 0.5</td>
                                <td className="p-3 text-right border border-slate-300 font-bold">{maiArea.toFixed(1)}</td>
                            </tr>
                            <tr className="bg-sky-50 font-bold">
                                <td className="p-3 border border-slate-300 uppercase" colSpan={2}>Tổng diện tích quy đổi</td>
                                <td className="p-3 text-right border border-slate-300 text-sky-800 font-black">{totalArea.toFixed(1)} m²</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {data.imageUrl && (
                    <div className="mt-6 mb-8">
                        <div className="flex justify-between items-end mb-4 border-b pb-2">
                            <h4 className="text-[14px] font-bold uppercase text-slate-900">2. Phối cảnh minh họa dự án</h4>
                        </div>
                        <div className="rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-slate-50 shadow-inner">
                            <img src={data.imageUrl} alt="Phối cảnh dự án" className="w-full h-full object-cover" crossOrigin="anonymous" />
                        </div>
                    </div>
                )}
            </div>

            {/* Trang 2: Phạm vi công việc và Chữ ký */}
            <div id="capture-page-2" className="pdf-page bg-white mx-auto p-[15mm] w-[210mm] min-h-[297mm] font-sans text-slate-800 shadow-sm mb-10 overflow-hidden relative border border-slate-200">
                <div className="mb-8">
                    <h4 className="text-[14px] font-bold uppercase text-slate-900 mb-4 border-b pb-2">3. Đơn giá & Thành tiền</h4>
                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[13px]">Đơn giá thi công chuẩn (m²)</span>
                            <span className="font-bold">{unitPriceTho.toLocaleString()} VNĐ/m²</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-t border-slate-200">
                            <span className="text-[13px] font-bold">Tổng giá trị (Đã bao gồm thuế)</span>
                            <span className="text-xl font-black text-sky-700">{totalCost.toLocaleString()} VNĐ</span>
                        </div>
                    </div>
                </div>

                <div className="mb-10">
                    <h4 className="text-[14px] font-bold uppercase text-slate-900 mb-4 border-b pb-2">4. Phạm vi công việc chính</h4>
                    <div className="grid grid-cols-1 gap-y-3">
                        {[
                            { label: "Chuẩn bị:", text: "Lập lán trại, vận chuyển thiết bị, tập kết vật tư đầu vào." },
                            { label: "Phần thô:", text: "Đào móng, đổ bê tông cốt thép, xây tường, lắp đặt hệ thống điện nước âm." },
                            { label: "Hoàn thiện:", text: "Trát tường, ốp lát gạch, sơn bả, lắp đặt thiết bị vệ sinh, đèn chiếu sáng." },
                            { label: "Hạ tầng:", text: "Thi công sân vườn, cổng rào và hệ thống thoát nước tổng thể (nếu có)." },
                            { label: "Vệ sinh:", text: "Vệ sinh công nghiệp và bàn giao công trình đưa vào sử dụng." },
                            { label: "Pháp lý:", text: "Hỗ trợ xin phép xây dựng và hoàn công dự án." }
                        ].map((item, i) => (
                            <div key={i} className="flex gap-3 text-[13px] items-start border-b border-slate-50 pb-2">
                                <div className="mt-1 flex-shrink-0"><CheckSquare size={14} className="text-sky-600"/></div>
                                <div><span className="font-bold text-slate-700">{item.label}</span> {item.text}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-5 bg-amber-50 rounded-xl border border-amber-100 mb-10">
                    <div className="flex gap-3">
                        <AlertCircle size={18} className="text-amber-600 flex-shrink-0"/>
                        <p className="text-[11px] text-amber-800 italic">Lưu ý: Báo giá có giá trị trong vòng 30 ngày. Đơn giá có thể điều chỉnh dựa trên điều kiện thực tế của mặt bằng thi công và thời điểm ký kết hợp đồng.</p>
                    </div>
                </div>

                <div className="mt-20 grid grid-cols-2 text-center absolute bottom-[30mm] left-0 right-0 px-[15mm]">
                    <div>
                        <p className="font-bold uppercase text-[11px] mb-24 text-slate-400">Đại diện Chủ đầu tư</p>
                        <p className="text-slate-300 italic text-[10px]">(Ký và ghi rõ họ tên)</p>
                    </div>
                    <div>
                        <p className="font-bold uppercase text-[11px] mb-24">Đại diện Nhà thầu</p>
                        <div className="relative inline-block">
                             <p className="font-bold text-sky-800 text-lg">PHỐ XANH AI</p>
                             <div className="absolute -top-4 -right-8 opacity-20"><Stamp size={64} className="text-red-600 rotate-12"/></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Trang 3: Chi tiết báo giá từ AI */}
            {(data.content || data.timeline) && (
                <div id="capture-page-3" className="pdf-page bg-white mx-auto p-[15mm] w-[210mm] min-h-[297mm] font-sans text-slate-800 shadow-sm mb-10 overflow-hidden relative border border-slate-200">
                    {data.timeline && (
                        <div className="mb-10">
                            <h4 className="text-[14px] font-bold uppercase text-slate-900 mb-4 border-b pb-2">5. Tiến độ thi công dự kiến</h4>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={data.timeline} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" unit=" tháng" />
                                        <YAxis dataKey="task" type="category" width={120} tick={{fontSize: 11}} />
                                        <Tooltip cursor={{fill: 'transparent'}} formatter={(value: number, name: string) => [value + ' tháng', name === 'duration' ? 'Thời gian' : 'Bắt đầu']} />
                                        <Bar dataKey="start" stackId="a" fill="transparent" />
                                        <Bar dataKey="duration" stackId="a" fill="#0284c7" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    
                    {data.content && (
                        <div className="mb-8">
                            <h4 className="text-[14px] font-bold uppercase text-slate-900 mb-4 border-b pb-2">{data.timeline ? '6' : '5'}. Chi tiết các hạng mục và điều khoản (AI Đề xuất)</h4>
                            <div className="text-justify text-[13px] leading-[1.8] admin-body markdown-body">
                                <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{cleanContentFromAI(data.content)}</Markdown>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

const DocumentTemplate = React.forwardRef(({ data }: {data: any}, ref: any) => {
    const today = new Date();

    return (
        <div ref={ref} className="print-area bg-slate-100 p-4 md:p-8 overflow-x-auto">
            <div id="capture-doc" className="pdf-page bg-white mx-auto p-[25mm] w-[210mm] min-h-[297mm] font-serif text-slate-900 shadow-sm border border-slate-200 mb-10 leading-relaxed overflow-hidden relative">
                <div className="flex flex-col items-center text-center mb-10">
                    <p className="font-bold text-[12pt] uppercase tracking-tighter">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="font-bold text-[13pt]">Độc lập - Tự do - Hạnh phúc</p>
                    <div className="w-40 h-[1px] bg-black mt-2"></div>
                    <p className="italic text-[11pt] self-end mt-12">
                        {data.location}, ngày {today.getDate()} tháng {today.getMonth() + 1} năm {today.getFullYear()}
                    </p>
                </div>
                
                <div className="text-center mb-10">
                    <h2 className="font-bold uppercase text-[16pt] leading-tight mb-2">{data.title}</h2>
                    <p className="text-[11pt] italic text-slate-600">Dự án: {data.buildingType || 'Nhà phố'} tại {data.location}</p>
                    {data.acceptanceObject && <p className="text-[11pt] italic text-slate-600 mt-1">Đối tượng: {data.acceptanceObject}</p>}
                </div>

                <div className="text-justify text-[13pt] leading-[1.8] admin-body markdown-body mb-10">
                    <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{cleanContentFromAI(data.content)}</Markdown>
                </div>

                {data.timeline && (
                    <div className="mb-20">
                        <h3 className="font-bold uppercase text-[14pt] mb-4">Tiến độ thi công dự kiến</h3>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={data.timeline} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" unit=" tháng" />
                                    <YAxis dataKey="task" type="category" width={150} tick={{fontSize: 12}} />
                                    <Tooltip cursor={{fill: 'transparent'}} formatter={(value: number, name: string) => [value + ' tháng', name === 'duration' ? 'Thời gian' : 'Bắt đầu']} />
                                    <Bar dataKey="start" stackId="a" fill="transparent" />
                                    <Bar dataKey="duration" stackId="a" fill="#0284c7" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 text-center absolute bottom-[40mm] left-0 right-0 px-[25mm]">
                    <div>
                        <p className="font-bold uppercase text-[11pt]">ĐẠI DIỆN BÊN A</p>
                        <p className="italic text-[9pt] text-slate-400 mt-1">(Chủ đầu tư)</p>
                    </div>
                    <div>
                        <p className="font-bold uppercase text-[11pt]">ĐẠI DIỆN BÊN B</p>
                        <p className="italic text-[9pt] text-slate-400 mt-1">(Nhà thầu Phố Xanh)</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

// --- MAIN APP ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState('home');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>('pricing');
  const [exporting, setExporting] = useState(false);
  const [isReviewingLegal, setIsReviewingLegal] = useState(false);
  const [internalData, setInternalData] = useState(() => localStorage.getItem('phoxanh_internal_data') || '');
  const [useInternalData, setUseInternalData] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    situation: '', location: 'TP. Hồ Chí Minh', subType: '', area: '120', floors: '2', buildingType: 'Nhà phố', manualUnitPrice: '', priceSource: 'market',
    acceptanceObject: '', participants: '', acceptanceTime: ''
  });
  
  const contentRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /* Firebase is disabled in this mockup
    try {
        const firebaseConfig = JSON.parse(__firebase_config);
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'phoxanh-v5-pro';

        const initAuth = async () => {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token).catch(() => signInAnonymously(auth));
          } else {
            await signInAnonymously(auth);
          }
        };
        initAuth();

        const unsub = onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser(u);
                const q = query(collection(db, 'artifacts', appId, 'users', u.uid, 'history'), orderBy('timestamp', 'desc'), limit(12));
                const unsubSnap = onSnapshot(q, (sn) => {
                  setHistory(sn.docs.map(d => ({ id: d.id, ...d.data() })));
                }, (e) => console.error("Firestore Error:", e));
                return () => unsubSnap();
            }
        });
        return () => unsub();
    } catch (e) { console.error("Firebase Init Error:", e); }
    */
  }, []);

  const handleExportImage = async () => {
    setExporting(true);
    
    try {
        const isPricing = result.mode === 'pricing' || result.title?.includes('Báo giá');
        const elementIds = isPricing ? ['capture-page-1', 'capture-page-2'] : ['capture-doc'];
        
        for (const id of elementIds) {
            const element = document.getElementById(id);
            if (!element) continue;
            
            const dataUrl = await htmlToImage.toPng(element, {
                pixelRatio: 2,
                backgroundColor: "#ffffff"
            });
            
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `${result.title.replace(/\s+/g, '_')}_${id}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (err) {
        console.error("Export error:", err);
    } finally {
        setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReviewLegal = async () => {
    if (!result || !result.content) return;
    setIsReviewingLegal(true);
    try {
        const prompt = `Bạn là một chuyên gia pháp lý trong lĩnh vực xây dựng tại Việt Nam.
Hãy rà soát kỹ văn bản dưới đây. Nhiệm vụ của bạn là:
1. Kiểm tra tất cả các căn cứ pháp lý (Luật, Nghị định, Thông tư, Tiêu chuẩn, Quy chuẩn...) được nhắc đến trong văn bản.
2. Nếu có văn bản nào đã cũ, hết hiệu lực hoặc có văn bản mới thay thế, hãy CẬP NHẬT chúng thành văn bản pháp luật MỚI NHẤT hiện hành đang có hiệu lực.
3. Giữ nguyên hoàn toàn cấu trúc, văn phong và các nội dung khác của văn bản gốc.
4. CHỈ trả về nội dung văn bản sau khi đã cập nhật, không giải thích gì thêm.

VĂN BẢN GỐC:
${result.content}`;

        const response = await getAIClient().models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });
        
        const updatedContent = response.text;
        
        setResult(prev => ({
            ...prev,
            content: updatedContent
        }));
        
        alert("Đã rà soát và cập nhật các căn cứ pháp lý thành công!");
    } catch (error) {
        console.error("Lỗi khi rà soát pháp lý:", error);
        alert("Có lỗi xảy ra khi rà soát pháp lý. Vui lòng thử lại.");
    } finally {
        setIsReviewingLegal(false);
    }
  };

  const handleExportWord = () => {
    if (!result) return;
    setExporting(true);
    try {
        const wrapper = document.getElementById('document-content-wrapper');
        if (!wrapper) return;

        const clone = wrapper.cloneNode(true) as HTMLElement;
        
        const noPrintElements = clone.querySelectorAll('.no-print');
        noPrintElements.forEach(el => el.parentNode?.removeChild(el));

        const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>${result.title}</title>
            <style>
                body { font-family: 'Times New Roman', serif; font-size: 12pt; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
                th, td { border: 1px solid black; padding: 5px; text-align: left; }
                th { font-weight: bold; }
                h1, h2, h3, h4, h5, h6 { font-family: 'Times New Roman', serif; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .mb-4 { margin-bottom: 1rem; }
                .mt-4 { margin-top: 1rem; }
            </style>
        </head>
        <body>`;
        const postHtml = "</body></html>";
        const html = preHtml + clone.innerHTML + postHtml;

        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${result.title.replace(/\s+/g, '_')}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Word Export Error:", error);
        alert("Có lỗi xảy ra khi xuất file Word.");
    } finally {
        setExporting(false);
    }
  };

  const generateImage = async (promptText: string) => {
    try {
        const response = await getAIClient().models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: promptText }]
          },
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
        return null;
    } catch (e) {
        console.error("Image generation error:", e);
        return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.csv') || file.name.endsWith('.json')) {
        const text = await file.text();
        try {
          const catResponse = await getAIClient().models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Phân loại tài liệu sau đây thuộc nhóm nào trong ngành xây dựng (ví dụ: Báo giá, Hợp đồng, Biện pháp thi công, Tiêu chuẩn, Bản vẽ, Khác...)? Chỉ trả về tên phân loại trong ngoặc vuông, ví dụ [PHÂN LOẠI: BÁO GIÁ].\n\nNội dung:\n${text.substring(0, 3000)}`
          });
          const category = catResponse.text.trim();
          setInternalData(prev => prev + (prev ? '\n\n' : '') + `--- Tài liệu: ${file.name} | ${category} ---\n` + text);
        } catch (err) {
          setInternalData(prev => prev + (prev ? '\n\n' : '') + `--- Tài liệu: ${file.name} | [PHÂN LOẠI: CHƯA XÁC ĐỊNH] ---\n` + text);
        }
        setUploading(false);
      } else {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];
            const mimeType = file.type || 'application/pdf';

            const response = await getAIClient().models.generateContent({
              model: "gemini-3-flash-preview",
              contents: {
                parts: [
                  {
                    inlineData: {
                      data: base64Data,
                      mimeType: mimeType
                    }
                  },
                  {
                    text: "Trích xuất toàn bộ văn bản từ tài liệu này một cách chính xác nhất. Ở dòng đầu tiên của kết quả, BẮT BUỘC thêm một thẻ phân loại tài liệu dựa trên nội dung (ví dụ: [PHÂN LOẠI: BÁO GIÁ], [PHÂN LOẠI: HỢP ĐỒNG], [PHÂN LOẠI: QUY TRÌNH], v.v.). Sau đó xuống dòng và in ra toàn bộ nội dung văn bản. Không thêm bình luận nào khác."
                  }
                ]
              }
            });
            const extractedText = response.text;
            setInternalData(prev => prev + (prev ? '\n\n' : '') + `--- Tài liệu: ${file.name} ---\n` + extractedText);
          } catch (err) {
            console.error("Lỗi trích xuất văn bản:", err);
            alert("Có lỗi xảy ra khi trích xuất văn bản từ tài liệu.");
          } finally {
            setUploading(false);
          }
        };
        reader.onerror = () => {
          alert("Lỗi khi đọc file");
          setUploading(false);
        };
        return;
      }
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi tải tài liệu lên.");
      setUploading(false);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async (eOrDocName?: React.MouseEvent | string) => {
    const targetSubType = typeof eOrDocName === 'string' ? eOrDocName : formData.subType;
    if (!targetSubType) return;

    if (typeof eOrDocName === 'string') {
      setFormData(prev => ({ ...prev, subType: eOrDocName }));
    }

    setLoading(true);
    setView('processing');
    
    try {
        let prompt = "";
        
        const isRecord = targetSubType.toLowerCase().includes('biên bản') || targetSubType.toLowerCase().includes('nhật ký');
        const isDrawingList = targetSubType.toLowerCase().includes('bản vẽ thiết kế thi công');
        const isDailyLog = targetSubType.toLowerCase().includes('nhật ký công trình');
        const isArisingVolume = targetSubType.toLowerCase().includes('phát sinh') && targetSubType.toLowerCase().includes('khối lượng');
        
        let projectInfo = `- Thông tin dự án: Loại công trình ${formData.buildingType}, địa điểm ${formData.location}, quy mô ${formData.area}m2, ${formData.floors} tầng.`;
        if (isRecord) {
            projectInfo = `- Thông tin dự án: Loại công trình ${formData.buildingType}, địa điểm ${formData.location}.
- Đối tượng nghiệm thu/công việc: ${formData.acceptanceObject || 'Theo thực tế thi công'}
- Thời gian: ${formData.acceptanceTime || 'Theo thực tế'}
- Thành phần tham gia: ${formData.participants || 'Các bên liên quan'}`;
        }

        const baseD1D2D3 = `[D1 - ĐỊNH DANH]: Bạn là Kỹ sư, Chuyên gia với hơn 15 năm kinh nghiệm thực chiến, am hiểu sâu sắc các Quy chuẩn kỹ thuật quốc gia (QCVN), Tiêu chuẩn Việt Nam (TCVN) và các Nghị định pháp luật trong lĩnh vực xây dựng.
[D2 - ĐÍCH ĐẾN]: Thực hiện nhiệm vụ soạn thảo văn bản chuyên nghiệp: "${targetSubType}".
[D3 - DỮ LIỆU]:
${projectInfo}
- Ghi chú cụ thể của khách hàng: ${formData.situation}.`;

        let formatInstructions = `[D5 - ĐỊNH DẠNG]:
- BẮT BUỘC trình bày theo CHUẨN VĂN BẢN HÀNH CHÍNH CHUYÊN NGHIỆP, BỐ CỤC TRANG A4 THEO NGHỊ ĐỊNH 30/2020/NĐ-CP.
- ĐỐI VỚI HỢP ĐỒNG XÂY DỰNG: BẮT BUỘC tuân thủ theo mẫu và quy định của NGHỊ ĐỊNH 37/2015/NĐ-CP (hoặc các nghị định sửa đổi, bổ sung liên quan về hợp đồng xây dựng).
- ĐỐI VỚI HỒ SƠ QUẢN LÝ CHẤT LƯỢNG (Biên bản nghiệm thu, nhật ký...): BẮT BUỘC tuân thủ theo mẫu và quy định của NGHỊ ĐỊNH 06/2021/NĐ-CP về quản lý chất lượng, thi công xây dựng và bảo trì công trình xây dựng.
- Phân chia rõ ràng thành các Phần, Điều, Khoản (ví dụ: ĐIỀU 1:..., 1.1..., 1.2...).
- Trình bày các đầu mục (1.1, 1.2...) in đậm. MỖI ĐẦU MỤC PHẢI BẮT ĐẦU Ở MỘT DÒNG MỚI. Nội dung chi tiết của đầu mục đó có thể viết liền sau tiêu đề trên cùng một dòng.
- Sử dụng Markdown để in đậm các tiêu đề Điều, Khoản.
- LOẠI BỎ HOÀN TOÀN các ký tự đặc biệt thừa thãi (như *, #, -, _ không cần thiết), giữ văn bản sạch sẽ, trang trọng.
- BẮT BUỘC phải có MỤC LỤC (Table of Contents) ở đầu văn bản, liệt kê tất cả các phần chính.`;

        if (isDrawingList) {
            formatInstructions = `[D5 - ĐỊNH DẠNG VÀ NỘI DUNG CHUẨN]:
- BẮT BUỘC trình bày theo CHUẨN VĂN BẢN HÀNH CHÍNH CHUYÊN NGHIỆP, BỐ CỤC TRANG A4 THEO NGHỊ ĐỊNH 30/2020/NĐ-CP.
- NỘI DUNG CHÍNH: Liệt kê chi tiết DANH MỤC CÁC BẢN VẼ trong hồ sơ thiết kế thi công (Bao gồm: Kiến trúc, Kết cấu, Điện nước MEP, Nội thất...).
- Trình bày dưới dạng bảng (sử dụng Markdown table) hoặc danh sách rõ ràng gồm: Số thứ tự, Ký hiệu bản vẽ, Tên bản vẽ, Tỷ lệ.
- LOẠI BỎ HOÀN TOÀN các ký tự đặc biệt thừa thãi.
- KHÔNG CẦN MỤC LỤC.`;
        } else if (isArisingVolume) {
            formatInstructions = `[D5 - ĐỊNH DẠNG VÀ NỘI DUNG CHUẨN]:
- BẮT BUỘC trình bày theo CHUẨN VĂN BẢN HÀNH CHÍNH CHUYÊN NGHIỆP, BỐ CỤC TRANG A4 THEO NGHỊ ĐỊNH 30/2020/NĐ-CP.
- NỘI DUNG CHÍNH: Biên bản xác nhận khối lượng phát sinh.
- BẮT BUỘC trình bày chi tiết khối lượng phát sinh dưới dạng BẢNG TÍNH DỰ TOÁN (sử dụng Markdown table). Bảng phải có các cột: STT, Nội dung công việc phát sinh, Đơn vị tính, Khối lượng, Đơn giá, Thành tiền, Ghi chú.
- Phía trên bảng cần có đầy đủ thông tin: Tên công trình, Hạng mục, Địa điểm, Thành phần tham gia xác nhận (Chủ đầu tư, Tư vấn giám sát, Nhà thầu thi công).
- Phía dưới bảng cần có phần chốt tổng giá trị phát sinh (bằng số và bằng chữ) và chữ ký xác nhận của các bên.
- LOẠI BỎ HOÀN TOÀN các ký tự đặc biệt thừa thãi.
- KHÔNG CẦN MỤC LỤC.`;
        } else if (isDailyLog) {
            formatInstructions = `[D5 - ĐỊNH DẠNG VÀ NỘI DUNG CHUẨN]:
- BẮT BUỘC trình bày theo CHUẨN VĂN BẢN HÀNH CHÍNH CHUYÊN NGHIỆP, BỐ CỤC TRANG A4 THEO NGHỊ ĐỊNH 30/2020/NĐ-CP.
- NỘI DUNG CHÍNH: Đây là BIỂU MẪU VIẾT NHẬT KÝ THI CÔNG CÔNG TRÌNH tuân thủ tuyệt đối theo NGHỊ ĐỊNH 06/2021/NĐ-CP.
- Bao gồm các thông tin bắt buộc: Ngày tháng năm, Tình hình thời tiết, Số lượng nhân công/thiết bị, Các công việc thi công trong ngày, Nghiệm thu công việc (nếu có), Sự cố phát sinh (nếu có), Chữ ký của Giám sát và Chỉ huy trưởng.
- Trình bày rõ ràng, súc tích, chừa khoảng trống (bằng các dòng kẻ chấm hoặc gạch dưới) để ghi chép thực tế.
- LOẠI BỎ HOÀN TOÀN các ký tự đặc biệt thừa thãi.
- KHÔNG CẦN MỤC LỤC.`;
        } else if (isRecord) {
            formatInstructions = `[D5 - ĐỊNH DẠNG VÀ NỘI DUNG CHUẨN]:
- BẮT BUỘC trình bày theo CHUẨN VĂN BẢN HÀNH CHÍNH CHUYÊN NGHIỆP, BỐ CỤC TRANG A4 THEO NGHỊ ĐỊNH 30/2020/NĐ-CP.
- BẮT BUỘC tuân thủ theo mẫu và quy định của NGHỊ ĐỊNH 06/2021/NĐ-CP về quản lý chất lượng, thi công xây dựng và bảo trì công trình xây dựng.
- Thành phần tham gia ký kết thường tinh gọn: Chủ đầu tư (Chủ nhà), Đại diện Đơn vị thi công (Chỉ huy trưởng/Kỹ thuật), và Tư vấn giám sát (nếu có).
- Nội dung đánh giá cần thực tế, ngắn gọn, đi thẳng vào các tiêu chí kỹ thuật cốt lõi (ví dụ: kích thước hình học, độ thẳng đứng, mác bê tông, chủng loại vật tư...).
- Bao gồm đầy đủ các mục: 
  1. Tên công trình & Vị trí.
  2. Đối tượng/Hạng mục nghiệm thu.
  3. Thành phần trực tiếp nghiệm thu.
  4. Thời gian và địa điểm nghiệm thu.
  5. Đánh giá công việc xây dựng (Tài liệu làm căn cứ, Tiêu chuẩn áp dụng, Đánh giá chất lượng thực tế).
  6. Kết luận (Đồng ý nghiệm thu chuyển bước thi công hay yêu cầu sửa chữa).
  7. Chữ ký các bên (Chủ đầu tư, Giám sát, Thi công).
- KHÔNG CẦN MỤC LỤC.
- Trình bày các đầu mục in đậm. MỖI ĐẦU MỤC PHẢI BẮT ĐẦU Ở MỘT DÒNG MỚI. Nội dung chi tiết của đầu mục đó có thể viết liền sau tiêu đề trên cùng một dòng.
- Sử dụng Markdown để in đậm các tiêu đề.
- LOẠI BỎ HOÀN TOÀN các ký tự đặc biệt thừa thãi, giữ văn bản sạch sẽ.
- Tạo sẵn các dòng gạch dưới (_____) để các bên ký và ghi rõ họ tên ở cuối biên bản.`;
        }

        if (useInternalData && internalData) {
            prompt = `${baseD1D2D3}
- KHO TÀI LIỆU NỘI BỘ CỦA CÔNG TY (Đã được phân loại):
${internalData}

[D4 - ĐIỀU KIỆN]:
1. Tuân thủ tuyệt đối các Quy chuẩn xây dựng và TCVN hiện hành.
2. LỌC TÀI LIỆU: Kho tài liệu nội bộ bên trên chứa nhiều tệp với các [PHÂN LOẠI] khác nhau. Bạn PHẢI tự động đọc, đối chiếu với chủ đề yêu cầu ("${targetSubType}") và CHỈ SỬ DỤNG các tài liệu có phân loại/nội dung liên quan trực tiếp. Bỏ qua hoàn toàn các tài liệu không liên quan.
3. TRUY XUẤT VÀ SỬ DỤNG CHÍNH XÁC dữ liệu từ các tài liệu nội bộ ĐÃ ĐƯỢC CHỌN LỌC.
4. TUYỆT ĐỐI tuân thủ các đơn giá, quy trình, vật tư, và các điều khoản hợp đồng có trong tài liệu nội bộ phù hợp. KHÔNG ĐƯỢC tự ý sáng tạo, bịa đặt nếu trong tài liệu nội bộ đã quy định rõ.
5. Tuyệt đối không bao gồm Tiêu ngữ Quốc hiệu.
6. Văn phong hành chính, kỹ thuật chuẩn xác, chuyên nghiệp.

${formatInstructions}`;
        } else {
            prompt = `${baseD1D2D3}

[D4 - ĐIỀU KIỆN]:
1. Tuân thủ tuyệt đối các Quy chuẩn xây dựng và TCVN hiện hành.
2. Tuyệt đối không bao gồm Tiêu ngữ Quốc hiệu.
3. Văn phong hành chính, kỹ thuật chuẩn xác, chuyên nghiệp.

${formatInstructions}`;
        }
        
        const response = await getAIClient().models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        const content = response.text;

        let unitPrice = null;
        if (targetSubType.toLowerCase().includes("báo giá")) {
            if (formData.priceSource === 'manual' && formData.manualUnitPrice && parseInt(formData.manualUnitPrice) > 0) {
                unitPrice = parseInt(formData.manualUnitPrice);
            } else if (formData.priceSource === 'internal' && internalData) {
                try {
                    const priceResponse = await getAIClient().models.generateContent({
                        model: "gemini-3-flash-preview",
                        contents: `Dựa vào tài liệu nội bộ sau đây, hãy tìm và trích xuất ĐƠN GIÁ THI CÔNG CHUẨN (VNĐ/m2) áp dụng cho loại công trình "${formData.buildingType}" và gói "${targetSubType}". 
Yêu cầu:
- CHỈ trả về MỘT CON SỐ DUY NHẤT (ví dụ: 6500000). 
- KHÔNG giải thích thêm. 
- Nếu trong tài liệu không có đơn giá nào, hãy trả về số 0.

TÀI LIỆU NỘI BỘ:
${internalData.substring(0, 15000)}`
                    });
                    const priceStr = priceResponse.text.replace(/[^0-9]/g, '');
                    if (priceStr && parseInt(priceStr) > 100000) {
                        unitPrice = parseInt(priceStr);
                    }
                } catch (err) {
                    console.error("Lỗi trích xuất đơn giá nội bộ:", err);
                }
            } else if (formData.priceSource === 'market' || formData.priceSource === 'ai_estimate') {
                try {
                    const priceResponse = await getAIClient().models.generateContent({
                        model: "gemini-3-flash-preview",
                        contents: `Hãy ước tính ĐƠN GIÁ THI CÔNG CHUẨN (VNĐ/m2) trung bình trên thị trường hiện nay áp dụng cho loại công trình "${formData.buildingType}" tại "${formData.location}" và gói "${targetSubType}".
Yêu cầu:
- CHỈ trả về MỘT CON SỐ DUY NHẤT (ví dụ: 6500000). 
- KHÔNG giải thích thêm.`
                    });
                    const priceStr = priceResponse.text.replace(/[^0-9]/g, '');
                    if (priceStr && parseInt(priceStr) > 100000) {
                        unitPrice = parseInt(priceStr);
                    }
                } catch (err) {
                    console.error("Lỗi ước tính đơn giá thị trường:", err);
                }
            }
        }

        let imageUrl = null;
        if (targetSubType.toLowerCase().includes("báo giá")) {
            const buildingTypeEng = formData.buildingType === 'Nhà phố' ? 'townhouse' : 
                                  formData.buildingType === 'Biệt thự' ? 'villa' : 
                                  formData.buildingType === 'Nhà cấp 4' ? 'single-story house' :
                                  formData.buildingType === 'Căn hộ chung cư' ? 'apartment interior' :
                                  formData.buildingType === 'Văn phòng' ? 'office building' : 'building';
            const imgPrompt = `A high quality 3D architectural rendering of a modern ${formData.floors}-story ${buildingTypeEng} in ${formData.location}, photorealistic, bright lighting.`;
            imageUrl = await generateImage(imgPrompt);
        }

        let timelineData = null;
        if (!isRecord) {
            try {
                const timelineResponse = await getAIClient().models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: `Dựa vào thông tin công trình: ${formData.buildingType}, ${formData.floors} tầng, diện tích ${formData.area}m2. Hãy lập tiến độ thi công dự kiến.
Trả về định dạng JSON là một mảng các object, mỗi object có các trường:
- "task": Tên hạng mục (ví dụ: "Chuẩn bị mặt bằng", "Thi công móng", "Thi công phần thân", "Hoàn thiện", "Bàn giao")
- "start": Tháng bắt đầu (số nguyên hoặc thập phân, từ 0)
- "duration": Thời gian thi công (số tháng)
Chỉ trả về JSON, không giải thích thêm.`,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    task: { type: Type.STRING },
                                    start: { type: Type.NUMBER },
                                    duration: { type: Type.NUMBER }
                                },
                                required: ["task", "start", "duration"]
                            }
                        }
                    }
                });
                timelineData = JSON.parse(timelineResponse.text);
            } catch (err) {
                console.error("Lỗi trích xuất tiến độ:", err);
                // Default timeline
                timelineData = [
                    { task: "Chuẩn bị mặt bằng", start: 0, duration: 0.5 },
                    { task: "Thi công móng", start: 0.5, duration: 1 },
                    { task: "Thi công phần thân", start: 1.5, duration: 2 },
                    { task: "Hoàn thiện", start: 3.5, duration: 1.5 },
                    { task: "Bàn giao", start: 5, duration: 0.5 }
                ];
            }
        }
        
        const resObjForDisplay = { 
            title: targetSubType, 
            content: content || "", 
            location: formData.location,
            area: formData.area,
            floors: formData.floors,
            buildingType: formData.buildingType,
            imageUrl: imageUrl, 
            unitPrice: unitPrice,
            timeline: timelineData,
            acceptanceObject: formData.acceptanceObject,
            acceptanceTime: formData.acceptanceTime,
            participants: formData.participants,
            mode: targetSubType.toLowerCase().includes('báo giá') ? 'pricing' : 'document',
            timestamp: new Date().toISOString() 
        };

        const resObjForFirestore = { 
            ...resObjForDisplay,
            imageUrl: imageUrl && imageUrl.length > 500000 ? null : imageUrl 
        };
        
        /* Firebase is disabled in this mockup
        if (user) {
            const db = getFirestore();
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'phoxanh-v5-pro';
            try {
                await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), resObjForFirestore);
            } catch (firestoreError) {
                console.warn("Firestore save error (possibly image size), displaying anyway...", firestoreError);
            }
        }
        */

        setResult(resObjForDisplay);
        setView('result');
    } catch (e) {
        console.error("Initialization error:", e);
        setView('generator');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-sky-200">
      <Header currentUser={user} />
      
      <div className="bg-white border-b border-slate-200 sticky top-[68px] z-40 no-print">
        <div className="container mx-auto flex overflow-x-auto scrollbar-hide">
          <button onClick={() => { setView('home'); setResult(null); }} className={`px-4 py-3 md:px-8 md:py-5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${view === 'home' ? 'border-sky-600 text-sky-700 bg-sky-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <HomeIcon size={16}/> Dự án của tôi
          </button>
          <button onClick={() => { setView('generator'); setResult(null); }} className={`px-4 py-3 md:px-8 md:py-5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${view === 'generator' ? 'border-sky-600 text-sky-700 bg-sky-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <PenTool size={16}/> Tạo hồ sơ mới
          </button>
          <button onClick={() => { setView('workflow'); setResult(null); }} className={`px-4 py-3 md:px-8 md:py-5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${view === 'workflow' ? 'border-sky-600 text-sky-700 bg-sky-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <ClipboardList size={16}/> Quy trình thi công
          </button>
          <button onClick={() => { setView('internal'); setResult(null); }} className={`px-4 py-3 md:px-8 md:py-5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${view === 'internal' ? 'border-sky-600 text-sky-700 bg-sky-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <FileText size={16}/> Tài liệu nội bộ
          </button>
          <button onClick={() => { setView('market'); setResult(null); }} className={`px-4 py-3 md:px-8 md:py-5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${view === 'market' ? 'border-sky-600 text-sky-700 bg-sky-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <TrendingUp size={16}/> Đơn giá thị trường
          </button>
        </div>
      </div>

      <main className="container mx-auto py-6 md:py-10 px-4 md:px-6">
        {view === 'home' && (
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight uppercase">Kho Hồ Sơ Dự Án</h2>
                    <button onClick={() => setView('generator')} className="bg-sky-600 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-sky-700 transition-all">
                        <PenTool size={14}/> Tạo mới
                    </button>
                </div>
                
                {history.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                        {history.map(item => (
                            <div key={item.id} onClick={() => { setResult(item); setView('result'); }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-2xl hover:border-sky-400 cursor-pointer transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-sky-50 rounded-bl-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-500 opacity-50"></div>
                                <div className="flex justify-between items-start mb-6 relative z-10">
                                    <div className="p-3 rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-all">
                                        <FileText size={20}/>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded italic">
                                        {new Date(item.timestamp).toLocaleDateString('vi-VN')}
                                    </span>
                                </div>
                                <h3 className="font-bold text-slate-800 text-base leading-snug mb-4 group-hover:text-sky-700 transition-colors h-12 line-clamp-2">{item.title}</h3>
                                <div className="border-t pt-4 flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
                                    <span className="flex items-center gap-1"><MapPin size={12}/> {item.location}</span>
                                    <span>{item.area}m² | {item.floors}T</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] py-32 flex flex-col items-center justify-center text-slate-400">
                        <div className="p-6 bg-slate-50 rounded-full mb-6"><Briefcase size={48}/></div>
                        <p className="font-bold text-sm uppercase tracking-widest">Chưa có hồ sơ nào được tạo.</p>
                        <button onClick={() => setView('generator')} className="mt-4 text-sky-600 font-bold hover:underline">Bắt đầu khởi tạo ngay</button>
                    </div>
                )}
            </div>
        )}

        {view === 'workflow' && (
            <WorkflowView onDocumentClick={(docName) => handleGenerate(docName)} />
        )}

        {view === 'market' && (
            <MarketPrices />
        )}

        {view === 'generator' && (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-10 duration-500">
            <div className="lg:col-span-5 space-y-4">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase mb-6 flex items-center gap-2">
                        <ClipboardList size={18} className="text-sky-600"/> Danh mục văn bản
                    </h3>
                    <div className="space-y-3">
                        {CATEGORIES.map(cat => (
                            <div key={cat.id} className={`rounded-2xl border transition-all overflow-hidden ${expandedCat === cat.id ? 'border-sky-500 shadow-md shadow-sky-50' : 'border-slate-100'}`}>
                                <button onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)} className={`w-full p-4 flex justify-between items-center font-bold text-sm ${expandedCat === cat.id ? 'bg-sky-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                    <div className="flex items-center gap-3"><cat.icon size={18}/>{cat.label}</div>
                                    {expandedCat === cat.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </button>
                                {expandedCat === cat.id && (
                                    <div className="p-2 bg-white space-y-1">
                                        {cat.types.map(type => (
                                            <button key={type} onClick={() => setFormData({...formData, subType: type})} className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex justify-between items-center ${formData.subType === type ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                                                {type}
                                                {formData.subType === type && <CheckSquare size={14} className="text-sky-600"/>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-7 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
                <div className="p-6 md:p-8 bg-[#0c4a6e] text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold uppercase tracking-tight">Chi tiết hồ sơ</h3>
                        <p className="text-sky-200 text-[10px] mt-1 tracking-widest uppercase">Tự động tối ưu hóa theo quy chuẩn TCVN</p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-2xl"><Camera size={24}/></div>
                </div>
                
                <div className="p-10 space-y-6">
                    <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100 flex items-start gap-4">
                        <Info size={20} className="text-sky-600 mt-1 flex-shrink-0"/>
                        <div>
                            <p className="text-xs font-bold text-sky-900 uppercase">Hồ sơ đang chọn:</p>
                            <p className="text-sm font-black text-sky-700 mt-1">{formData.subType || "Vui lòng chọn từ danh mục bên trái"}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Loại công trình</label>
                            <select className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:border-sky-500 outline-none" value={formData.buildingType} onChange={e => setFormData({...formData, buildingType: e.target.value})}>
                                {BUILDING_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Địa điểm thi công</label>
                            <select className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:border-sky-500 outline-none" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})}>
                                {VIETNAM_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {!(formData.subType.toLowerCase().includes('biên bản') || formData.subType.toLowerCase().includes('nhật ký')) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Diện tích (m²)</label>
                                <input type="number" value={formData.area} className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:border-sky-500 outline-none" onChange={e => setFormData({...formData, area: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Số tầng</label>
                                <input type="number" value={formData.floors} className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:border-sky-500 outline-none" onChange={e => setFormData({...formData, floors: e.target.value})} />
                            </div>
                        </div>
                    )}

                    {(formData.subType.toLowerCase().includes('biên bản') || formData.subType.toLowerCase().includes('nhật ký')) && (
                        <>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Đối tượng nghiệm thu / Nội dung công việc</label>
                                <input type="text" placeholder="VD: Nghiệm thu cốt thép móng, Nghiệm thu xây tường tầng 1..." value={formData.acceptanceObject} className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:border-sky-500 outline-none" onChange={e => setFormData({...formData, acceptanceObject: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Thời gian thực hiện</label>
                                    <input type="text" placeholder="VD: 08:00 ngày 15/10/2023" value={formData.acceptanceTime} className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:border-sky-500 outline-none" onChange={e => setFormData({...formData, acceptanceTime: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Thành phần tham gia</label>
                                    <input type="text" placeholder="VD: Chủ nhà, Đại diện thi công, Giám sát" value={formData.participants} className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:border-sky-500 outline-none" onChange={e => setFormData({...formData, participants: e.target.value})} />
                                </div>
                            </div>
                        </>
                    )}

                    {formData.subType.toLowerCase().includes('báo giá') && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Nguồn đơn giá thi công</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setFormData({...formData, priceSource: 'market'})}
                                    className={`p-3 rounded-xl text-xs font-bold border transition-all ${formData.priceSource === 'market' ? 'bg-sky-50 border-sky-500 text-sky-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    Thị trường
                                </button>
                                <button 
                                    onClick={() => setFormData({...formData, priceSource: 'internal'})}
                                    className={`p-3 rounded-xl text-xs font-bold border transition-all ${formData.priceSource === 'internal' ? 'bg-sky-50 border-sky-500 text-sky-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    Nội bộ
                                </button>
                                <button 
                                    onClick={() => setFormData({...formData, priceSource: 'manual'})}
                                    className={`p-3 rounded-xl text-xs font-bold border transition-all ${formData.priceSource === 'manual' ? 'bg-sky-50 border-sky-500 text-sky-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    Nhập tay
                                </button>
                                <button 
                                    onClick={() => setFormData({...formData, priceSource: 'ai_estimate'})}
                                    className={`p-3 rounded-xl text-xs font-bold border transition-all ${formData.priceSource === 'ai_estimate' ? 'bg-sky-50 border-sky-500 text-sky-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    AI Ước tính
                                </button>
                            </div>
                            
                            {formData.priceSource === 'manual' && (
                                <input 
                                    type="number" 
                                    placeholder="Nhập đơn giá (VNĐ/m²)" 
                                    value={formData.manualUnitPrice} 
                                    className="w-full p-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:border-sky-500 outline-none" 
                                    onChange={e => setFormData({...formData, manualUnitPrice: e.target.value})} 
                                />
                            )}
                            {formData.priceSource === 'internal' && !internalData && (
                                <p className="text-[10px] text-red-500 italic mt-1">Vui lòng tải lên tài liệu nội bộ ở tab "Tài liệu nội bộ" trước khi sử dụng.</p>
                            )}
                            {(formData.priceSource === 'market' || formData.priceSource === 'ai_estimate') && (
                                <p className="text-[10px] text-slate-500 italic mt-1">AI sẽ tự động ước tính đơn giá thị trường dựa trên loại công trình và khu vực.</p>
                            )}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Ghi chú yêu cầu kỹ thuật</label>
                        <textarea placeholder="Nhập các lưu ý về vật liệu, phong cách hoặc yêu cầu pháp lý..." className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm h-32 focus:ring-2 focus:ring-sky-500 outline-none transition-all" onChange={e => setFormData({...formData, situation: e.target.value})} />
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <input type="checkbox" id="useInternal" checked={useInternalData} onChange={e => setUseInternalData(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                        <label htmlFor="useInternal" className="text-sm font-bold text-slate-700 cursor-pointer">Sử dụng Tài liệu nội bộ (Báo giá, Quy chuẩn công ty)</label>
                    </div>

                    <button onClick={handleGenerate} disabled={loading || !formData.subType} className="w-full py-5 bg-sky-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-sky-700 disabled:opacity-50 disabled:bg-slate-300 transition-all flex items-center justify-center gap-3 shadow-xl shadow-sky-200">
                        {loading ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={20}/> Khởi tạo hồ sơ chuyên nghiệp</>}
                    </button>
                </div>
            </div>
          </div>
        )}

        {view === 'internal' && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight uppercase">Tài liệu nội bộ</h2>
                    <div className="flex flex-wrap gap-3">
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.csv,.md,.json,.pdf,image/*" />
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-white border border-slate-200 text-slate-700 px-6 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50">
                            {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14}/>}
                            {uploading ? 'Đang đọc...' : 'Tải tài liệu lên'}
                        </button>
                        <button onClick={() => {
                            localStorage.setItem('phoxanh_internal_data', internalData);
                            alert('Đã lưu tài liệu nội bộ!');
                        }} className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-emerald-700 transition-all">
                            <ShieldCheck size={14}/> Lưu tài liệu
                        </button>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-4">Nhập các quy chuẩn, đơn giá, điều khoản hợp đồng hoặc mẫu văn bản nội bộ của công ty bạn tại đây. Bạn cũng có thể tải lên file (PDF, hình ảnh, TXT) để AI tự động trích xuất nội dung.</p>
                    <textarea 
                        value={internalData}
                        onChange={e => setInternalData(e.target.value)}
                        placeholder="Ví dụ: Đơn giá xây thô năm 2024 là 3.800.000 VNĐ/m2. Quy trình nghiệm thu gồm 5 bước..." 
                        className="w-full p-6 rounded-2xl border border-slate-200 bg-slate-50 text-sm h-[500px] focus:ring-2 focus:ring-sky-500 outline-none transition-all leading-relaxed" 
                    />
                </div>
            </div>
        )}

        {view === 'processing' && (
            <div className="flex flex-col items-center justify-center py-32 space-y-6">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center"><HardHat size={28} className="text-sky-600"/></div>
                </div>
                <div className="text-center">
                    <p className="font-bold text-slate-800 text-xl uppercase tracking-tight">Hệ thống đang làm việc...</p>
                    <div className="flex flex-col gap-1 mt-2">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">1. Soạn thảo văn bản kỹ thuật</p>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse delay-75">2. Tạo phối cảnh dự án 3D</p>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse delay-150">3. Tối ưu hóa layout in ấn A4</p>
                    </div>
                </div>
            </div>
        )}

        {view === 'result' && result && (
            <div className="max-w-5xl mx-auto pb-32 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex flex-wrap justify-between items-center mb-8 no-print gap-4">
                    <button onClick={() => setView('home')} className="px-6 py-3 bg-white text-slate-500 font-bold text-xs uppercase flex items-center gap-2 hover:text-sky-600 rounded-xl border border-slate-200 transition-all shadow-sm">
                        <ArrowLeft size={16}/> Quay lại
                    </button>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={handleReviewLegal} disabled={isReviewingLegal} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg disabled:bg-slate-400">
                            {isReviewingLegal ? <Loader2 size={18} className="animate-spin"/> : <Scale size={18}/>}
                            {isReviewingLegal ? "Đang rà soát..." : "Rà soát Pháp lý"}
                        </button>
                        <button onClick={handleExportWord} disabled={exporting} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg disabled:bg-slate-400">
                            {exporting ? <Loader2 size={18} className="animate-spin"/> : <FileText size={18}/>}
                            {exporting ? "Đang xử lý..." : "Lưu về Word (Docs)"}
                        </button>
                        <button onClick={handleExportImage} disabled={exporting} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg disabled:bg-slate-400">
                            {exporting ? <Loader2 size={18} className="animate-spin"/> : <ImageIcon size={18}/>}
                            {exporting ? "Đang xử lý..." : "Xuất File Ảnh (Gửi Zalo)"}
                        </button>
                        <button onClick={handlePrint} className="px-6 py-3 bg-[#0c4a6e] text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-black transition-all">
                            <Printer size={18}/>
                            Xuất PDF / In
                        </button>
                        <button onClick={() => downloadTxtFile(result.title, result.content)} className="px-4 py-3 text-slate-400 hover:text-sky-600 transition-all">
                            <FileDown size={20}/>
                        </button>
                    </div>
                </div>
                
                <div className="no-print" id="document-content-wrapper">
                    {result.mode === 'pricing' || result.title?.includes('Báo giá') ? 
                        <PriceQuoteTemplate data={result} ref={contentRef} /> : 
                        <DocumentTemplate data={result} ref={contentRef} />
                    }
                </div>

                <div className="hidden print:block">
                    {result.mode === 'pricing' || result.title?.includes('Báo giá') ? 
                        <PriceQuoteTemplate data={result} ref={null} /> : 
                        <DocumentTemplate data={result} ref={null} />
                    }
                </div>
            </div>
        )}
      </main>

      <footer className="py-12 border-t border-slate-200 bg-white no-print">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 opacity-50">
                <div className="bg-slate-800 p-2 rounded text-white font-black text-xs">PX</div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Phố Xanh AI © 2024 - Công nghệ nhà thầu số</span>
            </div>
            <div className="flex gap-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <a href="#" className="hover:text-sky-600">Quy chuẩn</a>
                <a href="#" className="hover:text-sky-600">Pháp lý</a>
                <a href="#" className="hover:text-sky-600">Hướng dẫn</a>
            </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Noto+Serif:wght@400;700&display=swap');
        
        @media print {
            @page { 
                size: A4; 
                margin: 0; 
            }
            body { 
                background: white !important; 
                margin: 0 !important; 
                padding: 0 !important; 
            }
            .no-print { display: none !important; }
            .print-area { 
                width: 210mm; 
                margin: 0 auto;
                padding: 0 !important;
                background: white !important;
            }
            .pdf-page { 
                page-break-after: always;
                page-break-inside: avoid;
                margin: 0 !important; 
                border: none !important; 
                box-shadow: none !important;
                width: 210mm !important;
                height: 297mm !important;
                background: white !important;
                position: relative;
                overflow: hidden;
            }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }

        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .admin-body { font-family: 'Noto Serif', serif; }
        h1, h2, h3, h4, button, label { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}} />
    </div>
  );
}

const Header = ({ currentUser }: {currentUser: any}) => {
  const handleSetupKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
    } else {
      alert("Tính năng chọn API Key không khả dụng trong môi trường này.");
    }
  };

  return (
  <nav className="bg-[#0c4a6e] text-white p-4 sticky top-0 z-50 shadow-lg no-print">
    <div className="container mx-auto flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="bg-white p-2 rounded-xl shadow-inner shadow-sky-900/20"><HardHat size={22} className="text-[#0ea5e9]" /></div>
        <div>
          <h1 className="font-extrabold text-xl uppercase tracking-tighter leading-none">PHỐ XANH <span className="text-sky-400">AI</span></h1>
          <p className="text-[9px] text-sky-200/60 uppercase font-black tracking-widest mt-1">Hệ Thống Quản Trị Nhà Thầu 5.0</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={handleSetupKey}
          className="hidden md:block px-4 py-2 bg-sky-600/30 hover:bg-sky-600/50 rounded-xl text-xs font-bold transition-all border border-sky-400/30"
          title="Sử dụng API Key riêng để dùng các mô hình nâng cao"
        >
          Cấu hình API Key
        </button>
        {currentUser && (
          <div className="hidden md:flex bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl text-[10px] border border-white/10 text-white font-bold items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
            ID: {currentUser.uid}
          </div>
        )}
      </div>
    </div>
  </nav>
  );
};
