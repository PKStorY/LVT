'use client';

import React, { useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import { useAuthAdmin } from '@/context/AuthAdminContext';
import { cleanStallName, parseNumber, formatPrice } from '@/utils/numberHelper';
import { getModalDateFormat } from '@/utils/thaiDateHelper';
import {
  Store, X, Utensils, Shirt, CalendarDays, CheckCircle, AlertCircle,
  User, Zap, Banknote, Trash2, Plus, FileText, Move, Printer, Camera,
  Copy, Check
} from 'lucide-react';

export default function BookingDetailModal({
  showBookingModal,
  setShowBookingModal,
  selectedStall,
  selectedBooking,
  selectedDate,
  getStallStatus,
  getBookingCustomerType,
  stallPrice,
  setStallPrice,
  elecUnit,
  setElecUnit,
  elecPrice,
  setElecPrice,
  bookerName,
  setBookerName,
  product,
  setProduct,
  note,
  setNote,
  paymentList,
  setPaymentList,
  selectedStallsList,
  setSelectedStallsList,
  calculateDefaultStallPrice,
  showAddStallSelect,
  setShowAddStallSelect,
  stallFilter,
  setStallFilter,
  addStallDropdownRef,
  stalls,
  bookings,
  handleSaveBooking,
  handleDeleteBooking,
  handlePrintReceipt,
  handleShowReceiptPreview,
  handleMarkAbsent,
  setShowMoveLockModal,
  setShowAddUtilityModal,
  setAddUtilityUnit,
  setAddUtilityPrice,
  setAddUtilityMethod
}) {
  const { adminUser } = useAuthAdmin();
  const { setMoveTargetDate, setMoveTargetStall, fetchVacantStallsForDate } = useBooking();
  const [copied, setCopied] = useState(false);

  if (!showBookingModal || !selectedStall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border-2 border-[#8B4513] overflow-hidden animate-pop-in">
        
        {/* Modal Header */}
        <div className="bg-[#FAEBD7] border-b-2 border-[#8B4513] text-[#4A3B32] px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Store className="w-5 h-5 text-[#8B4513]" />
            <h3 className="font-extrabold text-sm md:text-base">ข้อมูลล็อค {selectedStall.name}</h3>
          </div>
          <button onClick={() => setShowBookingModal(false)} className="text-gray-500 hover:text-[#8B4513]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {!adminUser ? (
          // Customer / Guest Modal View
          <div className="p-6 flex flex-col gap-4 text-center">
            <div className="bg-gradient-to-br from-[#FAEBD7] to-amber-50/40 p-6 rounded-2xl border border-amber-200/80 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm border border-amber-100 flex-shrink-0">
                {selectedStall.type === 'อาหาร' ? (
                  <Utensils className="w-8 h-8 text-[#8B4513]" />
                ) : selectedStall.type === 'เสื้อผ้า' ? (
                  <Shirt className="w-8 h-8 text-[#8B4513]" />
                ) : (
                  <Store className="w-8 h-8 text-[#8B4513]" />
                )}
              </div>
              
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest">หมายเลขล็อค</span>
              <h2 className="text-4xl font-black text-[#4A3B32] mt-0.5 tracking-tight">{selectedStall.name}</h2>
              
              <span className="text-[10px] text-amber-900 font-extrabold bg-[#FAEBD7] border border-amber-250 px-3 py-1 rounded-full mt-3 shadow-xs">
                โซน {selectedStall.type}
              </span>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-700 font-extrabold bg-gray-50/80 p-3 rounded-xl border border-gray-200/50">
              <CalendarDays className="w-4 h-4 text-amber-800" />
              <span>วันที่ทำการค้า: {getModalDateFormat(selectedDate)}</span>
            </div>

            {(() => {
              const statusInfo = getStallStatus(selectedStall, selectedBooking);
              return (
                <>
                  {statusInfo.isVacant ? (
                    <div className="flex flex-col items-center gap-2 p-5 bg-green-50/50 border-2 border-dashed border-green-200 rounded-2xl text-center">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-green-800 font-extrabold">สถานะ: ล็อคว่างพร้อมจอง</span>
                      <span className="text-2xl font-black text-green-700 mt-0.5">
                        {statusInfo.price} <span className="text-xs font-bold text-gray-500">บาท / วัน</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 p-5 bg-red-50/50 border-2 border-dashed border-red-200 rounded-2xl text-center">
                      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-700">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-red-800 font-extrabold">สถานะ: ล็อคไม่ว่าง (จองแล้ว)</span>
                      
                      <div className="mt-1 border-t border-dashed border-red-200/60 pt-2 w-full text-center">
                        <span className="text-[9px] text-gray-500 font-extrabold uppercase block mb-0.5">ประเภทสินค้า</span>
                        <span className="text-sm font-extrabold text-gray-800 bg-white/70 px-4 py-1.5 rounded-lg border border-red-100 inline-block">
                          {statusInfo.product || 'ไม่มีข้อมูลสินค้า'}
                        </span>
                      </div>
                    </div>
                  )}

                  {statusInfo.isVacant && (() => {
                    const formattedDateStr = typeof getModalDateFormat === 'function' ? getModalDateFormat(selectedDate) : selectedDate;
                    const stallNameClean = cleanStallName(selectedStall.name);
                    const priceVal = statusInfo.price ? `${statusInfo.price} บาท` : 'ตามเรทผังตลาด';

                    const lineMessage = `สวัสดีครับ สนใจจองล็อคตลาดนัดลาดสวายวินเทจ\n📍 ล็อคที่สนใจ: [${stallNameClean}]\n📅 วันที่: ${formattedDateStr}\n💰 ราคา: ${priceVal}\n🛒 สินค้าที่ต้องการขาย: \n\n(หากต้องการเพิ่มล็อค สามารถพิมพ์ชื่อล็อคต่อท้ายได้เลยครับ)`;
                    const lineDeepLink = `https://line.me/R/oaMessage/@ladsawaivintage/?${encodeURIComponent(lineMessage)}`;

                    const handleCopyMessage = () => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(lineMessage);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2500);
                      }
                    };

                    return (
                      <div className="flex flex-col gap-2.5 mt-2">
                        {/* Preview Box of pre-filled text */}
                        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-left">
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 mb-1.5">
                            <span>💬 ข้อความที่จะนำไปใส่ในแชท LINE:</span>
                            <button
                              type="button"
                              onClick={handleCopyMessage}
                              className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-white/80 px-2 py-0.5 rounded border border-emerald-200 shadow-2xs hover:bg-white cursor-pointer transition-all active:scale-95"
                            >
                              {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              <span>{copied ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}</span>
                            </button>
                          </div>
                          <div className="text-[11px] text-gray-700 bg-white/90 p-2.5 rounded-lg border border-emerald-100 font-mono whitespace-pre-line leading-relaxed select-all">
                            {lineMessage}
                          </div>
                        </div>

                        {/* LINE Deep Link Action Button */}
                        <a 
                          href={lineDeepLink}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b34c] active:scale-98 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5 text-sm hover:shadow-lg cursor-pointer"
                        >
                          <img 
                            src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" 
                            alt="LINE" 
                            className="w-5 h-5 filter invert" 
                          />
                          จองล็อคนี้ผ่าน LINE (@ladsawaivintage)
                        </a>

                        <span className="text-[10px] text-gray-500 font-medium text-center">
                          * ระบบจะเปิดแชท LINE และใส่ข้อความให้อัตโนมัติ สามารถพิมพ์เพิ่มล็อคหรือสินค้าก่อนกดส่งได้ครับ
                        </span>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        ) : (
          // Admin View (Form & Controls)
          (() => {
            const computedStallPrice = parseNumber(stallPrice) > 0 
              ? parseNumber(stallPrice) 
              : (typeof calculateDefaultStallPrice === 'function' ? calculateDefaultStallPrice(selectedStallsList, selectedDate) : 0);
            const totalVal = computedStallPrice + parseNumber(elecPrice);
            const transferTotal = paymentList
              .filter(p => p.method === 'โอนเงิน')
              .reduce((sum, p) => sum + parseNumber(p.amount), 0);
            const cashTotal = paymentList
              .filter(p => p.method === 'เงินสด')
              .reduce((sum, p) => sum + parseNumber(p.amount), 0);

            const totalPaid = paymentList
              .filter(p => p.method && p.amount)
              .reduce((sum, p) => sum + parseNumber(p.amount), 0);

            const isFullyPaid = totalPaid >= totalVal && totalVal > 0;
            const isAlreadyPaid = selectedBooking && (selectedBooking.status === 'ชำระแล้ว' || selectedBooking.status === 'ไม่ว่าง') && (selectedBooking.type === 'รายวัน' || getBookingCustomerType(selectedBooking) === 'Regular');

            const cashNeeded = totalVal - transferTotal;
            const changeVal = (cashTotal > cashNeeded && cashNeeded >= 0) ? (cashTotal - cashNeeded) : 0;

            return (
              <>
                <div className="p-4 flex flex-col gap-3.5 max-h-[80vh] overflow-y-auto custom-scrollbar text-xs bg-[#FAF6EE]">
                  
                  {/* Date & Status Banner */}
                  <div className="flex justify-between items-center bg-[#FFFDF9] border-2 border-dashed border-[#8B4513]/40 rounded-xl p-3 shadow-xs font-bold text-xs text-[#5D4037]">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-[#F5E6D3] flex items-center justify-center text-[#8B4513] flex-shrink-0">
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-extrabold block uppercase tracking-wider">วันที่ทำการค้า</span>
                        <span className="text-xs font-black text-[#5D4037]">{getModalDateFormat(selectedDate)}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {(() => {
                        if (!selectedBooking) {
                          const isFood = selectedStall && (selectedStall.type === 'อาหาร' || selectedStall.type === 'ของสด');
                          return isFood ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 font-black text-[10px] shadow-xs font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse mr-0.5" /> ว่าง (อาหาร)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-black text-[10px] shadow-xs font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse mr-0.5" /> ว่าง (เสื้อผ้า)
                            </span>
                          );
                        } else if (selectedBooking.status === 'ชำระแล้ว' || selectedBooking.status === 'ไม่ว่าง') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-black text-[10px] shadow-xs font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-0.5" /> ชำระแล้ว
                            </span>
                          );
                        } else if (selectedBooking.status === 'ค้างชำระ') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-black text-[10px] shadow-xs font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-0.5" /> ค้างชำระ
                            </span>
                          );
                        } else {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-700 font-black text-[10px] shadow-xs font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-0.5" /> {selectedBooking.status}
                            </span>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  {/* Stall Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#5D4037] flex items-center justify-between">
                      <span>ล็อคที่จอง ({selectedStallsList.length} ล็อค)</span>
                      <span className="text-[10px] text-[#8B4513]/60 font-semibold">* คิดยอดรวมในบิลใบเดียว</span>
                    </label>
                    
                    <div className="flex flex-wrap gap-1.5 p-2 bg-[#FFFDF9] border border-[#8B4513]/25 rounded-lg min-h-[44px] items-center relative">
                      {selectedStallsList.map((st) => (
                        <span key={st.name} className="inline-flex items-center gap-1 bg-[#F5E6D3] border border-[#8B4513]/30 text-[#5D4037] font-mono font-extrabold text-xs px-2.5 py-1 rounded-md shadow-xs">
                          {cleanStallName(st.name)}
                          {selectedStallsList.length > 1 && !isAlreadyPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = selectedStallsList.filter(item => item.name !== st.name);
                                setSelectedStallsList(updated);
                                setStallPrice(calculateDefaultStallPrice(updated, selectedDate));
                              }}
                              className="text-amber-700 hover:text-red-700 font-black ml-1 text-[10px] transition-colors"
                              title="ลบออก"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}

                      {!isAlreadyPaid && (
                        <div className="relative" ref={addStallDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setShowAddStallSelect(!showAddStallSelect)}
                            className="px-2.5 py-1 bg-[#8B4513] hover:bg-[#5D4037] text-white rounded text-[10px] font-bold shadow-sm transition-all flex items-center gap-0.5"
                          >
                            + เพิ่มล็อค
                          </button>
                          
                          {showAddStallSelect && (
                            <div className="absolute left-0 mt-1.5 w-48 bg-white border border-[#8B4513]/25 rounded-lg shadow-xl z-50 p-2 flex flex-col gap-1 max-h-[220px] overflow-y-auto custom-scrollbar">
                              <input
                                type="text"
                                value={stallFilter}
                                onChange={(e) => setStallFilter(e.target.value)}
                                placeholder="ค้นหาชื่อล็อค..."
                                className="p-1.5 border border-red-500 rounded text-xs text-gray-800 bg-red-50/10 focus:outline-none focus:ring-1 focus:ring-red-500 font-bold mb-1"
                                autoFocus
                              />
                              {(() => {
                                const vacantStalls = stalls.filter(s => 
                                  s.type !== 'ทางเดิน' && 
                                  s.type !== 'อื่นๆ' && 
                                  !bookings.some(b => b.status !== 'ลา' && (b.stall_name === s.name || (b.stall_name && b.stall_name.split(',').map(name => name.trim()).includes(s.name)))) && 
                                  !selectedStallsList.some(item => item.name === s.name)
                                );
                                const filteredVacant = vacantStalls.filter(s => 
                                  s.name.toLowerCase().includes(stallFilter.toLowerCase())
                                );
                                
                                const sortedVacant = [...filteredVacant].sort((a, b) => {
                                  const isFoodA = a.type === 'อาหาร';
                                  const isFoodB = b.type === 'อาหาร';
                                  if (isFoodA && !isFoodB) return -1;
                                  if (!isFoodA && isFoodB) return 1;
                                  const nameA = a.name.replace(/[\[\]]/g, '');
                                  const nameB = b.name.replace(/[\[\]]/g, '');
                                  return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                                });
                                
                                if (sortedVacant.length === 0) {
                                  return <span className="text-[10px] text-gray-400 text-center py-2">ไม่พบชื่อล็อคที่ตรงกัน</span>;
                                }
                                
                                return sortedVacant.map((vSt) => (
                                  <button
                                    key={vSt.name}
                                    type="button"
                                    onClick={() => {
                                      const updated = [...selectedStallsList, vSt];
                                      setSelectedStallsList(updated);
                                      setStallPrice(calculateDefaultStallPrice(updated, selectedDate));
                                      setShowAddStallSelect(false);
                                      setStallFilter('');
                                    }}
                                    className="w-full text-left px-2 py-1.5 hover:bg-amber-50 rounded text-xs font-mono font-bold text-gray-700 flex justify-between items-center transition-colors border-b border-gray-100 last:border-b-0"
                                  >
                                    <span>{cleanStallName(vSt.name)}</span>
                                    <span className="text-[9px] text-gray-400 font-medium">({vSt.type})</span>
                                  </button>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Booker Name & Product */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[#5D4037] flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-[#8B4513] shrink-0" /> ชื่อผู้ค้า / เบอร์โทร *
                      </label>
                      <input 
                        type="text" 
                        value={bookerName}
                        onChange={(e) => setBookerName(e.target.value)}
                        placeholder="ชื่อและเบอร์ติดต่อ"
                        className="p-2 border border-[#8B4513]/30 rounded-lg text-xs text-gray-800 bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#8B4513]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[#5D4037] flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-[#8B4513] shrink-0" /> สินค้าที่ขาย *
                      </label>
                      <input 
                        type="text" 
                        value={product}
                        onChange={(e) => setProduct(e.target.value)}
                        placeholder="เช่น เสื้อผ้าวินเทจ"
                        className="p-2 border border-[#8B4513]/30 rounded-lg text-xs text-gray-800 bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#8B4513]"
                      />
                    </div>
                  </div>

                  {/* Electric Unit & Total Price */}
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[#5D4037] flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-[#8B4513] shrink-0" /> ค่าไฟ (หน่วย)
                        </span>
                        {elecPrice > 0 && <span className="text-[10px] text-[#8B4513] font-bold">({elecPrice} บ.)</span>}
                      </label>
                      <input 
                        type="number" 
                        disabled={isAlreadyPaid}
                        value={elecUnit}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = parseNumber(e.target.value);
                          setElecUnit(val);
                          setElecPrice(val * 10);
                        }}
                        className={`p-2 border border-[#8B4513]/30 rounded-lg text-xs text-gray-800 bg-[#FFFDF9] text-center focus:outline-none focus:ring-1 focus:ring-[#8B4513] ${
                          isAlreadyPaid ? 'opacity-65 bg-gray-100 cursor-not-allowed' : ''
                        }`}
                        placeholder="0 หน่วย"
                      />
                    </div>
                    <div className="bg-[#FFFDF9] border-2 border-dashed border-[#8B4513] rounded-lg p-2.5 flex flex-col justify-center h-[42px] text-center shadow-xs">
                      <div className="flex justify-between items-center text-xs font-black text-[#5D4037] px-0.5 font-bold">
                        <span>รวมเงินทั้งสิ้น:</span>
                        <span className="text-sm md:text-base font-black text-red-800 font-mono">
                          {formatPrice(totalVal)} บ.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Section */}
                  <div className="flex flex-col gap-2 bg-[#FFFDF9] border border-[#8B4513]/25 rounded-xl p-3 shadow-xs">
                    <label className="text-xs font-bold text-[#5D4037] flex items-center gap-1 border-b border-[#8B4513]/10 pb-1.5">
                      <Banknote className="w-3.5 h-3.5 text-[#8B4513] shrink-0" /> รับเงินชำระ (บาท)
                    </label>
                    
                    <div className="flex flex-col gap-2">
                      {paymentList.map((entry, index) => {
                        const isAmountEntered = entry.amount && parseNumber(entry.amount) > 0;
                        return (
                          <div key={index} className="flex items-center gap-2">
                            <div className="flex-1 relative">
                              <input
                                type="number"
                                disabled={isAlreadyPaid || entry.isSaved}
                                value={entry.amount}
                                onChange={(e) => {
                                  const updated = [...paymentList];
                                  updated[index].amount = e.target.value;
                                  setPaymentList(updated);
                                }}
                                placeholder="กรอกยอดเงินชำระ"
                                className={`w-full p-2 border border-[#8B4513]/30 rounded-lg text-xs text-right text-gray-800 bg-white font-mono font-extrabold focus:outline-none focus:ring-1 focus:ring-[#8B4513] ${
                                  (isAlreadyPaid || entry.isSaved) ? 'opacity-65 bg-gray-100 cursor-not-allowed' : ''
                                }`}
                              />
                            </div>

                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={!isAmountEntered || isAlreadyPaid || entry.isSaved}
                                onClick={() => {
                                  const updated = [...paymentList];
                                  updated[index].method = 'เงินสด';
                                  setPaymentList(updated);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                  (isAlreadyPaid || entry.isSaved)
                                    ? entry.method === 'เงินสด'
                                      ? 'bg-[#5D4037] text-white border-[#5D4037] opacity-80 pointer-events-none shadow-xs'
                                      : 'bg-gray-100/70 text-gray-400 border-gray-200 opacity-40 pointer-events-none'
                                    : !isAmountEntered
                                      ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-40 cursor-not-allowed pointer-events-none'
                                      : entry.method === 'เงินสด'
                                        ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-xs'
                                        : 'bg-white text-gray-500 border-[#8B4513]/25 hover:bg-amber-50'
                                }`}
                              >
                                เงินสด
                              </button>
                              <button
                                type="button"
                                disabled={!isAmountEntered || isAlreadyPaid || entry.isSaved}
                                onClick={() => {
                                  const updated = [...paymentList];
                                  updated[index].method = 'โอนเงิน';
                                  setPaymentList(updated);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                  (isAlreadyPaid || entry.isSaved)
                                    ? entry.method === 'โอนเงิน'
                                      ? 'bg-[#5D4037] text-white border-[#5D4037] opacity-80 pointer-events-none shadow-xs'
                                      : 'bg-gray-100/70 text-gray-400 border-gray-200 opacity-40 pointer-events-none'
                                    : !isAmountEntered
                                      ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-40 cursor-not-allowed pointer-events-none'
                                      : entry.method === 'โอนเงิน'
                                        ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-xs'
                                        : 'bg-white text-gray-500 border-[#8B4513]/25 hover:bg-amber-50'
                                }`}
                              >
                                โอนจ่าย
                              </button>
                            </div>

                            {paymentList.length > 1 && !isAlreadyPaid && !entry.isSaved && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = paymentList.filter((_, idx) => idx !== index);
                                  setPaymentList(updated);
                                }}
                                className="p-1 rounded text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors shrink-0"
                                title="ลบช่องทางนี้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!isFullyPaid && (
                      <button
                        type="button"
                        onClick={() => setPaymentList([...paymentList, { method: '', amount: '' }])}
                        className="w-full mt-1 py-1.5 bg-[#FAF6EE] hover:bg-[#F5E6D3] text-[#8B4513] rounded-lg text-xs font-bold border border-dashed border-[#8B4513]/40 transition-all flex items-center justify-center gap-1 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> เพิ่มการชำระเงิน
                      </button>
                    )}

                    {changeVal > 0 && (
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200 text-right">
                        <span className="inline-block bg-green-50 border border-green-200 text-green-700 font-mono font-extrabold text-[11px] px-3 py-1 rounded-lg">
                          เงินทอน: {formatPrice(changeVal)} บาท
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Note */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#5D4037] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#8B4513]" /> โน้ตกรอกข้อความ
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="กรอกข้อความหมายเหตุเพิ่มเติม..."
                      rows="2"
                      className="p-2 border border-[#8B4513]/30 rounded-lg text-xs text-gray-800 bg-[#FFFDF9] focus:outline-none focus:ring-2 focus:ring-[#8B4513]"
                    />
                  </div>

                  {/* Extra Admin tools */}
                  {selectedBooking && (selectedBooking.type === 'รายวัน' || selectedBooking.type === 'ประจำ') && isAlreadyPaid && (
                    <div className="mt-2.5 border-t border-[#8B4513]/10 pt-3.5 flex flex-col gap-2">
                      <span className="text-[10px] font-black text-[#8B4513]/60 uppercase tracking-widest block mb-0.5">เครื่องมือบริการลูกค้า:</span>
                      <div className="grid grid-cols-5 gap-1 w-full">
                        <button
                          type="button"
                          onClick={() => {
                            setAddUtilityUnit(1);
                            setAddUtilityPrice(10);
                            setAddUtilityMethod('');
                            setShowAddUtilityModal(true);
                          }}
                          className="px-0.5 py-1.5 sm:px-1 sm:py-2 md:px-2 bg-gradient-to-br from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-lg text-[8.5px] sm:text-[9.5px] md:text-xs font-black flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1 shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-amber-600/10 cursor-pointer text-center w-full whitespace-nowrap overflow-hidden"
                        >
                          <Zap className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> เพิ่มไฟ
                        </button>

                        <button
                          type="button"
                          onClick={handleMarkAbsent}
                          className="px-0.5 py-1.5 sm:px-1 sm:py-2 md:px-2 bg-gradient-to-br from-orange-600 to-red-700 hover:from-orange-700 hover:to-red-800 text-white rounded-lg text-[8.5px] sm:text-[9.5px] md:text-xs font-black flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1 shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-orange-600/10 cursor-pointer text-center w-full whitespace-nowrap overflow-hidden"
                        >
                          <X className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> แจ้งลา
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const initDate = selectedBooking?.date || selectedDate;
                            setMoveTargetDate(initDate);
                            setMoveTargetStall(null);
                            fetchVacantStallsForDate(initDate);
                            setShowMoveLockModal(true);
                          }}
                          className="px-0.5 py-1.5 sm:px-1 sm:py-2 md:px-2 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-lg text-[8.5px] sm:text-[9.5px] md:text-xs font-black flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1 shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-blue-600/10 cursor-pointer text-center w-full whitespace-nowrap overflow-hidden"
                        >
                          <Move className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> ย้ายล็อค
                        </button>

                        <button
                          type="button"
                          onClick={() => handleShowReceiptPreview(selectedBooking, selectedStall)}
                          className="px-0.5 py-1.5 sm:px-1 sm:py-2 md:px-2 bg-gradient-to-br from-purple-600 to-fuchsia-700 hover:from-purple-700 hover:to-fuchsia-800 text-white rounded-lg text-[8.5px] sm:text-[9.5px] md:text-xs font-black flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1 shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-purple-600/10 cursor-pointer text-center w-full whitespace-nowrap overflow-hidden"
                        >
                          <Camera className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> แคปตั๋ว
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintReceipt(selectedBooking, selectedStall)}
                          className="px-0.5 py-1.5 sm:px-1 sm:py-2 md:px-2 bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-lg text-[8.5px] sm:text-[9.5px] md:text-xs font-black flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1 shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border border-emerald-600/10 cursor-pointer text-center w-full whitespace-nowrap overflow-hidden"
                        >
                          <Printer className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> พิมพ์ตั๋ว
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="bg-[#FAEBD7] border-t-2 border-[#8B4513] p-3 flex justify-between items-center gap-2">
                  {selectedBooking && (!isFullyPaid && selectedBooking.status !== 'ชำระแล้ว') ? (
                    <button 
                      type="button"
                      onClick={handleDeleteBooking}
                      className="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-bold text-xs flex items-center gap-1 transition-all border border-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" /> ยกเลิกจอง
                    </button>
                  ) : <div />}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowBookingModal(false)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold text-xs transition-all"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      onClick={() => handleSaveBooking(isFullyPaid ? 'ชำระแล้ว' : 'ค้างชำระ', isFullyPaid)}
                      className="px-5 py-2 bg-[#8B4513] hover:bg-[#5D4037] text-white rounded-lg font-extrabold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1"
                    >
                      {isFullyPaid ? "บันทึก/พิมพ์ตั๋ว" : "บันทึก (ค้างจ่าย)"}
                    </button>
                  </div>
                </div>
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}
