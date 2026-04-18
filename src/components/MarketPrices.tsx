import React, { useState } from 'react';
import { Loader2, RefreshCw, MapPin, Home, DollarSign, TrendingUp } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const VIETNAM_PROVINCES = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Bình Dương", "Đồng Nai", "Long An", "Bà Rịa - Vũng Tàu", "Khác"];
const BUILDING_TYPES = ["Nhà phố", "Biệt thự", "Nhà cấp 4", "Căn hộ chung cư", "Văn phòng", "Khác"];

export const MarketPrices = () => {
  const [location, setLocation] = useState("TP. Hồ Chí Minh");
  const [buildingType, setBuildingType] = useState("Nhà phố");
  const [isLoading, setIsLoading] = useState(false);
  const [prices, setPrices] = useState<any>(null);

  const fetchPrices = async () => {
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Hãy ước tính đơn giá thị trường trung bình hiện tại (VNĐ/m2) cho loại hình công trình "${buildingType}" tại khu vực "${location}".
Trả về định dạng JSON chính xác với các trường sau (chỉ trả về số nguyên, không có dấu phẩy hay chữ):
{
  "design": <đơn giá thiết kế kiến trúc & nội thất>,
  "construction": <đơn giá thi công phần thô & nhân công hoàn thiện>,
  "roughMaterials": <đơn giá vật tư thô>,
  "finishing": <đơn giá vật tư hoàn thiện (mức khá)>,
  "mep": <đơn giá thi công cơ điện (MEP)>,
  "turnkey": <đơn giá xây nhà trọn gói (chìa khóa trao tay)>,
  "trend": "<xu hướng giá so với quý trước: tăng/giảm/ổn định>",
  "notes": "<ghi chú ngắn gọn về tình hình thị trường>"
}
Chỉ trả về JSON, không giải thích thêm.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const data = JSON.parse(response.text);
      setPrices(data);
    } catch (error) {
      console.error("Error fetching market prices:", error);
      alert("Có lỗi xảy ra khi cập nhật đơn giá thị trường.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (!price) return "Đang cập nhật...";
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price) + " / m²";
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <TrendingUp className="text-sky-600" /> Cập nhật đơn giá thị trường
            </h2>
            <p className="text-slate-500 mt-1">Tra cứu nhanh đơn giá thiết kế, thi công, vật tư theo khu vực (Dữ liệu ước tính từ AI)</p>
          </div>
          
          <button 
            onClick={fetchPrices}
            disabled={isLoading}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all disabled:opacity-70"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {isLoading ? 'Đang cập nhật...' : 'Cập nhật giá mới'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <MapPin size={16} className="text-sky-500" /> Khu vực
            </label>
            <select 
              className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 outline-none"
              value={location}
              onChange={e => setLocation(e.target.value)}
            >
              {VIETNAM_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Home size={16} className="text-sky-500" /> Loại hình công trình
            </label>
            <select 
              className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 outline-none"
              value={buildingType}
              onChange={e => setBuildingType(e.target.value)}
            >
              {BUILDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {prices && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="text-slate-500 text-sm font-bold mb-2">Đơn giá Thiết kế</div>
                <div className="text-2xl font-black text-slate-800">{formatPrice(prices.design)}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="text-slate-500 text-sm font-bold mb-2">Thi công Phần thô & Nhân công</div>
                <div className="text-2xl font-black text-slate-800">{formatPrice(prices.construction)}</div>
              </div>
              <div className="bg-sky-50 p-5 rounded-xl border border-sky-200 shadow-sm flex flex-col justify-between">
                <div className="text-sky-700 text-sm font-bold mb-2">Xây nhà Trọn gói (Chìa khóa trao tay)</div>
                <div className="text-2xl font-black text-sky-700">{formatPrice(prices.turnkey)}</div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" /> Chi tiết Vật tư & Cơ điện
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-xs font-bold uppercase mb-1">Vật tư thô</div>
                  <div className="text-lg font-bold text-slate-800">{formatPrice(prices.roughMaterials)}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-xs font-bold uppercase mb-1">Vật tư hoàn thiện</div>
                  <div className="text-lg font-bold text-slate-800">{formatPrice(prices.finishing)}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-xs font-bold uppercase mb-1">Thi công Cơ điện (MEP)</div>
                  <div className="text-lg font-bold text-slate-800">{formatPrice(prices.mep)}</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800 text-sm">
              <div className="mt-0.5">💡</div>
              <div>
                <strong>Xu hướng:</strong> {prices.trend}<br/>
                <strong>Ghi chú:</strong> {prices.notes}
              </div>
            </div>
          </div>
        )}

        {!prices && !isLoading && (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
            <TrendingUp size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Nhấn "Cập nhật giá mới" để xem đơn giá thị trường hiện tại.</p>
          </div>
        )}
      </div>
    </div>
  );
};
