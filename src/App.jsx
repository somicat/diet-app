import React, { useState, useEffect } from 'react';
import { Home, Utensils, Scale, Dumbbell, Plus, X, Activity, ArrowUp, ArrowDown, Database, Check, ChevronLeft, ChevronRight, Droplets, Calendar } from 'lucide-react';

// --- [초기 설정 및 목표] ---
const DAILY_GOALS = { kcal: 1400, carb: 140, protein: 80, fat: 40, sugar: 25 };
const START_WEIGHT = 52.0;

// 날짜 포맷 유틸
const getLocalDateString = (dateObj) => {
  const d = new Date(dateObj);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const todayStr = getLocalDateString(new Date());



export default function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('diet');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [selectedDietDate, setSelectedDietDate] = useState(todayStr);
  const [selectedWeightDate, setSelectedWeightDate] = useState(todayStr);

  const [nutritionDB, setNutritionDB] = useState({
    "고구마 1개(115g)": { kcal: 159, carb: 37.7, protein: 1.7, fat: 0.2, sugar: 0 },
    "닭가슴살 100g": { kcal: 110, carb: 0, protein: 23, fat: 1, sugar: 0 },
    "양배추 100g": { kcal: 20, carb: 5, protein: 1, fat: 0, sugar: 0 },
    "계란 1개": { kcal: 70, carb: 0.5, protein: 6, fat: 5, sugar: 0 },
    "사과 1개": { kcal: 95, carb: 25, protein: 0.5, fat: 0.3, sugar: 19 },
    "현미밥 1공기": { kcal: 300, carb: 65, protein: 6, fat: 1, sugar: 0 }
  });

  const [exerciseDB, setExerciseDB] = useState({
    "러닝": { part: "전신", type: "유산소", time: 30 },
    "스쿼트": { part: "하체", type: "무산소", time: 15 },
    "푸시업": { part: "상체", type: "무산소", time: 10 },
    "폼롤러": { part: "전신", type: "스트레칭", time: 15 },
    "아랫배": { part: "상체", type: "무산소", time: 15 },
    "자유 헬스": { part: "전신", type: "무산소", time: 0 }
  });

  const [dietLogs, setDietLogs] = useState([
    { id: 1, date: todayStr, meal: '아침', menu: '고구마 1개(115g)', qty: 1 },
    { id: 2, date: todayStr, meal: '점심', menu: '현미밥 1공기', qty: 1 },
    { id: 3, date: todayStr, meal: '점심', menu: '닭가슴살 100g', qty: 1 }
  ]);
  
  const generateMockWeights = () => {
    let logs = [];
    let curWeight = START_WEIGHT;
    for(let i=60; i>=1; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      curWeight = curWeight + (Math.random() * 0.4 - 0.2); 
      logs.push({
        id: Date.now() + i, date: getLocalDateString(d), time: '08:00',
        weight: Number(curWeight.toFixed(2)), restroom: Math.random() > 0.6 
      });
    }
    logs.push({ id: Date.now()+100, date: todayStr, time: '08:00', weight: curWeight - 0.2, restroom: true });
    logs.push({ id: Date.now()+101, date: todayStr, time: '18:00', weight: curWeight + 0.1, restroom: false });
    return logs;
  };
  const [weightLogs, setWeightLogs] = useState(generateMockWeights());

  const [exerciseLogs, setExerciseLogs] = useState([
    { id: 1, date: todayStr, name: '러닝', time: 30, part: '전신' },
    { id: 2, date: todayStr, name: '스쿼트', time: 15, part: '하체' }
  ]);

  const [selectedPlanDay, setSelectedPlanDay] = useState(1);
  const [weeklyExercisePlan, setWeeklyExercisePlan] = useState({
    0: [], 1: ['러닝', '스쿼트'], 2: ['푸시업', '아랫배'], 3: ['러닝'], 4: ['스쿼트', '폼롤러'], 5: ['자유 헬스'], 6: []
  });
      setFormData(prev => ({ ...prev, exerciseName: value, exTime: dbEx?.time > 0 ? dbEx.time : '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const getDayLogs = (logs, dateStr) => logs.filter(log => log.date === dateStr);

  const calculateMacros = (logs) => {
    return logs.reduce((acc, log) => {
      const info = nutritionDB[log.menu] || { kcal:0, carb:0, protein:0, fat:0, sugar:0 };
      return {
        kcal: acc.kcal + (info.kcal * log.qty), carb: acc.carb + (info.carb * log.qty),
        protein: acc.protein + (info.protein * log.qty), fat: acc.fat + (info.fat * log.qty),
        sugar: acc.sugar + (info.sugar * log.qty),
      };
    }, { kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0 });
  };

  const todayMacros = calculateMacros(getDayLogs(dietLogs, todayStr));
  const todayExercise = getDayLogs(exerciseLogs, todayStr);

  const amWeights = weightLogs.filter(w => parseInt(w.time.split(':')[0], 10) >= 6 && parseInt(w.time.split(':')[0], 10) < 15);
  const latestWeight = amWeights.length > 0 ? amWeights[amWeights.length - 1]?.weight : START_WEIGHT;
  const prevWeight = amWeights.length > 1 ? amWeights[amWeights.length - 2]?.weight : START_WEIGHT;
  const weightDiff = (latestWeight - prevWeight).toFixed(2);
  
  const msPerDay = 1000 * 60 * 60 * 24;
  const baseDate = new Date(todayStr); 
  const last8Weeks = [];
  for(let i=7; i>=0; i--) {
      let count = 0;
      weightLogs.forEach(w => {
          if(!w.restroom) return;
          const d = new Date(w.date);
          const diffDays = Math.round((baseDate - d) / msPerDay);
          if (diffDays >= i*7 && diffDays < (i+1)*7) count++;
      });
      last8Weeks.push({ weekLabel: i===0 ? "이번주" : `${i}주전`, count });
  }
  const recent7DaysRestroomCount = last8Weeks[7].count; 

  const submitLog = (e) => {
    e.preventDefault();
    const newLog = { id: Date.now(), date: todayStr };
    if (modalType === 'diet') {
      setDietLogs([...dietLogs, { ...newLog, meal: formData.meal, menu: formData.menu, qty: Number(formData.qty) }]);
    } else if (modalType === 'weight') {
      setWeightLogs([...weightLogs, { ...newLog, weight: Number(formData.weight), time: formData.time, restroom: formData.restroom }].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
    } else if (modalType === 'exercise') {
      const ex = exerciseDB[formData.exerciseName];
      setExerciseLogs([...exerciseLogs, { ...newLog, name: formData.exerciseName, time: Number(formData.exTime), part: ex.part }]);
    }
    setIsModalOpen(false);
  };

  const generateCalendarDays = (year, month) => {
    const days = [];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(getLocalDateString(new Date(year, month, i)));
    return days;
  };

  const handleMonthChange = (offset) => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));

  

  

  

  const renderDashboard = () => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayIdx = new Date().getDay();
    const todaysPlan = weeklyExercisePlan[todayIdx] || [];

    return (
      <div className="space-y-4 pb-20 animate-fade-in flex flex-col items-center">
        
        <div className="grid grid-cols-2 gap-4 w-full mb-1">
          <div className="h-32 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col justify-center items-center relative">
            <span className="text-3xl font-black tracking-tight mb-2 text-blue-600">D+48</span>
            <span className="text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">감량기 목표까지</span>
          </div>
          <div className="h-32 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col justify-center items-center relative">
            <span className="text-[11px] font-bold text-gray-400 mb-1">오늘의 체중</span>
            <div className="text-3xl font-extrabold text-gray-800 flex items-end tracking-tighter mb-2">
              {latestWeight} <span className="text-sm font-medium text-gray-400 ml-1 mb-1 tracking-normal">kg</span>
            </div>
            <div className="text-[10px] font-bold flex items-center justify-center bg-gray-50 px-2.5 py-1 rounded-full text-gray-500 border border-gray-100">
              전날대비: {Number(weightDiff) > 0 ? <span className="text-red-500 flex items-center ml-1"><ArrowUp size={10}/> {weightDiff}</span> 
                        : Number(weightDiff) < 0 ? <span className="text-blue-500 flex items-center ml-1"><ArrowDown size={10}/> {Math.abs(weightDiff)}</span> : <span className="ml-1">-</span>}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 w-full">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center"><Activity size={16} className="mr-1 text-red-500"/> 남은 영양소 (오늘)</h3>
          {[
            { label: '칼로리', cur: todayMacros.kcal, max: DAILY_GOALS.kcal, unit: 'kcal', color: 'bg-red-400' },
            { label: '탄수화물', cur: todayMacros.carb, max: DAILY_GOALS.carb, unit: 'g', color: 'bg-blue-400' },
            { label: '단백질', cur: todayMacros.protein, max: DAILY_GOALS.protein, unit: 'g', color: 'bg-green-400' },
            { label: '지방', cur: todayMacros.fat, max: DAILY_GOALS.fat, unit: 'g', color: 'bg-yellow-400' },
            { label: '당류', cur: todayMacros.sugar, max: DAILY_GOALS.sugar, unit: 'g', color: 'bg-purple-400' }
          ].map(n => {
            const pct = Math.min((n.cur / n.max) * 100, 100);
            return (
              <div key={n.label} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-700">{n.label}</span>
                  <span className="text-gray-500">{n.cur.toFixed(1)} / {n.max}{n.unit} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${n.color}`} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between w-full">
          <div className="flex items-center">
            <div className="bg-red-50 p-2.5 rounded-xl mr-3"><Droplets size={20} className="text-red-400" /></div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">이번주 화장실 (최근 7일)</h3>
              <p className="text-[11px] text-gray-500">건강한 장 활동 체크</p>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-red-500">
            {recent7DaysRestroomCount} <span className="text-sm font-normal text-gray-400">회</span>
          </div>
        </div>

        {/* 🚨 오늘의 운동 계획 알리미 (AI 코멘트 위로 이동) 🚨 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 w-full mt-2">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center">
              <Calendar size={16} className="mr-1.5 text-indigo-500" />
              오늘의 운동 계획 ({dayNames[todayIdx]}요일)
            </h3>
          </div>
          {todaysPlan.length > 0 ? (
            <ul className="space-y-2">
              {todaysPlan.map((exName, idx) => {
                const exInfo = exerciseDB[exName] || { part: '알수없음', time: 0 };
                return (
                  <li key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="font-bold text-gray-800 text-sm flex items-center">
                       {exName}
                       <span className="ml-2 text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">{exInfo.part}</span>
                    </span>
                    <span className="text-xs font-bold text-gray-500">{exInfo.time > 0 ? `${exInfo.time}분` : '자유'}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-center py-5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-xs text-gray-500 font-medium">오늘은 계획된 운동이 없습니다.<br/>푹 쉬거나 가벼운 스트레칭은 어떨까요?</p>
            </div>
          )}
        </div>

        {/* 4. AI 트레이너 피드백 */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-2xl shadow-sm border border-indigo-100 w-full relative overflow-hidden">
          <div className="flex items-center mb-3">
            <Bot size={20} className="text-indigo-600 mr-2" />
            <h3 className="text-sm font-extrabold text-indigo-900">오늘의 AI 트레이너 코멘트</h3>
          </div>
          {isAiFeedbackLoading ? (
            <div className="animate-pulse flex space-x-2 items-center py-2 text-indigo-500 text-xs font-medium"><span>Gemini AI가 오늘의 기록을 분석하고 있어요...</span></div>
          ) : aiFeedback ? (
            <div className="text-sm text-indigo-800 leading-relaxed bg-white/60 p-4 rounded-xl border border-indigo-100/50 shadow-sm backdrop-blur-sm">{aiFeedback}</div>
          ) : (
            <div className="text-center py-2">
              <button onClick={getAiFeedback} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-full text-xs shadow-md transition-transform active:scale-95 flex items-center mx-auto">
                <Sparkles size={14} className="mr-1.5" /> ✨ AI 코멘트 받기
              </button>
              <p className="text-[10px] text-indigo-400 mt-2">오늘의 식단과 운동을 바탕으로 조언해드려요!</p>
            </div>
          )}
          {aiFeedbackError && <div className="text-xs text-red-500 mt-2">{aiFeedbackError}</div>}
        </div>
      </div>
    );
  }

  // ... (나머지 render 함수들 및 컴포넌트 구조는 이전과 동일)
  const renderDiet = () => { /* ... 이전 코드와 동일 ... */
    const days = generateCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth());
    const selectedLogs = getDayLogs(dietLogs, selectedDietDate);
    const selectedMacros = calculateMacros(selectedLogs);
    const meals = ['아침', '점심', '저녁', '간식'];
    const logsByMeal = meals.map(meal => ({
      meal, logs: selectedLogs.filter(l => l.meal === meal), macros: calculateMacros(selectedLogs.filter(l => l.meal === meal))
    }));

    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <div className="flex justify-between items-center px-2">
          <button onClick={() => handleMonthChange(-1)} className="p-1"><ChevronLeft/></button>
          <span className="font-bold text-lg">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</span>
          <button onClick={() => handleMonthChange(1)} className="p-1"><ChevronRight/></button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400 mb-2">
            <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((dateStr, idx) => {
              if (!dateStr) return <div key={`empty-${idx}`} className="h-10"></div>;
              const hasLog = getDayLogs(dietLogs, dateStr).length > 0;
              const isSelected = dateStr === selectedDietDate;
              return (
                <div 
                  key={dateStr} onClick={() => setSelectedDietDate(dateStr)}
                  className={`h-10 border rounded flex flex-col items-center justify-center relative cursor-pointer transition-colors
                    ${isSelected ? 'border-orange-400 bg-orange-50 font-bold text-orange-700' : 'border-transparent hover:bg-gray-50'}`}
                >
                  <span className="text-[12px]">{parseInt(dateStr.slice(-2), 10)}</span>
                  {hasLog && <div className="w-1.5 h-1.5 bg-orange-400 rounded-full absolute bottom-1"></div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex justify-between items-center">
            <h2 className="font-bold text-orange-800 flex items-center"><Utensils size={18} className="mr-2"/>{selectedDietDate.slice(5)} 식단 기록</h2>
          </div>
          <div className="p-4 space-y-5">
            {logsByMeal.map(({meal, logs, macros}) => (
              <div key={meal} className={logs.length === 0 ? "opacity-50" : ""}>
                <div className="flex justify-between items-end border-b pb-1 mb-2">
                  <h3 className="text-sm font-extrabold text-gray-700">{meal}</h3>
                  <span className="text-[10px] text-gray-500">
                    C:{macros.carb.toFixed(1)} P:{macros.protein.toFixed(1)} F:{macros.fat.toFixed(1)} S:{macros.sugar.toFixed(1)} <strong className="text-orange-500 ml-1">{macros.kcal.toFixed(0)}kcal</strong>
                  </span>
                </div>
                {logs.length > 0 ? (
                  <ul className="space-y-1">
                    {logs.map(log => {
                      const info = nutritionDB[log.menu];
                      return (
                        <li key={log.id} className="flex justify-between text-xs items-center bg-gray-50 p-1.5 rounded">
                          <span className="text-gray-800">{log.menu} <span className="text-gray-400">x{log.qty}</span></span>
                          <span className="text-gray-500">{info ? Math.round(info.kcal * log.qty) : 0} kcal</span>
                        </li>
                      )
                    })}
                  </ul>
                ) : <p className="text-[10px] text-gray-400">기록 없음</p>}
              </div>
            ))}
            <div className="mt-4 pt-4 border-t-2 border-gray-200">
              <h3 className="font-bold text-gray-800 mb-2 text-sm text-center">📊 일일 합계 및 잔여량</h3>
              <table className="w-full text-center text-[11px]">
                <thead>
                  <tr className="bg-gray-100 text-gray-600">
                    <th className="p-1.5">구분</th><th className="p-1.5">칼로리</th><th className="p-1.5">탄수</th>
                    <th className="p-1.5">단백질</th><th className="p-1.5">지방</th><th className="p-1.5">당류</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-bold bg-gray-50 text-gray-700">총 섭취</td>
                    <td className="p-2 text-orange-600 font-bold">{selectedMacros.kcal.toFixed(0)}</td>
                    <td className="p-2">{selectedMacros.carb.toFixed(1)}</td><td className="p-2">{selectedMacros.protein.toFixed(1)}</td>
                    <td className="p-2">{selectedMacros.fat.toFixed(1)}</td><td className="p-2">{selectedMacros.sugar.toFixed(1)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold bg-gray-50 text-gray-700">잔여량</td>
                    {[
                      { cur: selectedMacros.kcal, max: DAILY_GOALS.kcal }, { cur: selectedMacros.carb, max: DAILY_GOALS.carb },
                      { cur: selectedMacros.protein, max: DAILY_GOALS.protein }, { cur: selectedMacros.fat, max: DAILY_GOALS.fat },
                      { cur: selectedMacros.sugar, max: DAILY_GOALS.sugar }
                    ].map((item, i) => {
                      const diff = (item.max - item.cur).toFixed(1);
                      return <td key={i} className={`p-2 font-bold ${diff >= 0 ? 'text-blue-500' : 'text-red-500'}`}>{diff >= 0 ? `+${diff}` : diff}</td>
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  };

  const renderWeight = () => { /* ... 이전 코드와 동일 ... */
    const days = generateCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth());
    const targetDateObj = new Date(selectedWeightDate);
    const prevDateObj = new Date(targetDateObj); prevDateObj.setDate(targetDateObj.getDate() - 1);
    const prevDateStr = getLocalDateString(prevDateObj);

    const getAmWeight = (logs) => logs.find(w => { const h = parseInt(w.time.split(':')[0], 10); return h >= 6 && h < 15; })?.weight;
    const getPmWeight = (logs) => logs.find(w => { const h = parseInt(w.time.split(':')[0], 10); return h >= 15 || h < 6; })?.weight;

    const tLogs = weightLogs.filter(w => w.date === selectedWeightDate);
    const pLogs = weightLogs.filter(w => w.date === prevDateStr);

    const currentW = getAmWeight(tLogs) || getPmWeight(tLogs); 
    const diffPrevPm = (currentW && getPmWeight(pLogs)) ? (currentW - getPmWeight(pLogs)).toFixed(2) : null;
    const diffPrevAm = (currentW && getAmWeight(pLogs)) ? (currentW - getAmWeight(pLogs)).toFixed(2) : null;
    const diffStart = currentW ? (currentW - START_WEIGHT).toFixed(2) : null;

    const last30DaysWeights = amWeights.filter(w => new Date(w.date) >= new Date(Date.now() - 30 * 86400000)).sort((a,b) => a.date.localeCompare(b.date));
    let minW = START_WEIGHT, maxW = START_WEIGHT, points = "", minPoint = null, maxPoint = null, minIdx = 0, maxIdx = 0;
    if(last30DaysWeights.length > 0) {
      minPoint = last30DaysWeights.reduce((min, p) => p.weight < min.weight ? p : min, last30DaysWeights[0]);
      maxPoint = last30DaysWeights.reduce((max, p) => p.weight > max.weight ? p : max, last30DaysWeights[0]);
      minW = minPoint.weight - 0.5; maxW = maxPoint.weight + 0.5;
      const width = 300, height = 120, paddingY = 20; 
      const renderH = height - (paddingY * 2);
      points = last30DaysWeights.map((w, i) => {
        const x = (i / Math.max(1, last30DaysWeights.length - 1)) * width;
        const y = height - paddingY - ((w.weight - minW) / (maxW - minW)) * renderH;
        if(w.date === minPoint.date) minIdx = i;
        if(w.date === maxPoint.date) maxIdx = i;
        return `${x},${y}`;
      }).join(" ");
    }
    const MAX_RESTROOM_Y = Math.max(10, ...last8Weeks.map(w => w.count));

    const renderDiffVal = (val) => {
      if(val === null) return <span className="text-gray-400">-</span>;
      if(Number(val) > 0) return <span className="text-red-500 font-bold">+{val}</span>;
      if(Number(val) < 0) return <span className="text-blue-500 font-bold">{val}</span>;
      return <span className="text-gray-500 font-bold">{val}</span>;
    }

    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <div className="flex justify-between items-center px-2">
          <button onClick={() => handleMonthChange(-1)} className="p-1"><ChevronLeft/></button>
          <span className="font-bold text-lg">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</span>
          <button onClick={() => handleMonthChange(1)} className="p-1"><ChevronRight/></button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
           <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400 mb-2">
            <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((dateStr, idx) => {
              if (!dateStr) return <div key={`empty-${idx}`} className="h-16"></div>;
              const dayLogs = weightLogs.filter(w => w.date === dateStr);
              const amLog = getAmWeight(dayLogs); const pmLog = getPmWeight(dayLogs);
              const hasRestroom = dayLogs.some(w => w.restroom);
              const isSelected = dateStr === selectedWeightDate;

              return (
                <div 
                  key={dateStr} onClick={() => setSelectedWeightDate(dateStr)}
                  className={`h-16 border rounded bg-gray-50 flex flex-col items-center p-1 relative cursor-pointer transition-colors
                    ${isSelected ? 'border-blue-500 bg-blue-50 shadow-inner' : 'border-gray-100 hover:bg-gray-100'}`}
                >
                  <span className={`text-[10px] mb-0.5 ${isSelected ? 'text-blue-700 font-bold' : 'text-gray-500'}`}>{parseInt(dateStr.slice(-2), 10)}</span>
                  {hasRestroom && <Check size={12} strokeWidth={4} className="absolute top-1 right-1 text-red-500" />}
                  {amLog && <div className="bg-yellow-100 text-yellow-800 text-[9px] font-bold px-1 py-0.5 rounded-md w-full text-center truncate shadow-sm mb-0.5">{amLog}</div>}
                  {pmLog && <div className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1 py-0.5 rounded-md w-full text-center truncate shadow-sm">{pmLog}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
            <h2 className="font-bold text-blue-800 flex items-center"><Scale size={18} className="mr-2"/>{selectedWeightDate.slice(5)} 체중 분석</h2>
            <span className="text-sm font-extrabold text-blue-600">{currentW ? `${currentW} kg` : '기록 없음'}</span>
          </div>
          <div className="p-4">
            <table className="w-full text-center text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="pb-2 font-medium w-1/3 border-r">전날 오후 대비</th>
                  <th className="pb-2 font-medium w-1/3 border-r">전날 대비</th>
                  <th className="pb-2 font-medium w-1/3">첫 날 대비</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pt-3 border-r">{renderDiffVal(diffPrevPm)}</td>
                  <td className="pt-3 border-r">{renderDiffVal(diffPrevAm)}</td>
                  <td className="pt-3">{renderDiffVal(diffStart)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">📈 최근 1달 체중 변화</h3>
          <div className="relative w-full h-36 border-b border-l border-gray-200">
            {last30DaysWeights.length > 1 ? (
               <svg className="w-full h-full overflow-visible" viewBox="0 0 300 120" preserveAspectRatio="none">
                 <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" points={points} className="drop-shadow-sm"/>
                 {maxPoint && <text x={(maxIdx / (last30DaysWeights.length - 1)) * 300} y={120 - 20 - ((maxPoint.weight - minW) / (maxW - minW)) * 80 - 8} textAnchor="middle" fontSize="10" fill="#ef4444" fontWeight="bold">{maxPoint.weight}</text>}
                 {minPoint && <text x={(minIdx / (last30DaysWeights.length - 1)) * 300} y={120 - 20 - ((minPoint.weight - minW) / (maxW - minW)) * 80 + 12} textAnchor="middle" fontSize="10" fill="#3b82f6" fontWeight="bold">{minPoint.weight}</text>}
               </svg>
            ) : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">데이터가 부족합니다.</div>}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">🚽 최근 8주 화장실 횟수</h3>
          <div className="relative h-40 pt-4">
             <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 z-0">
                <div className="border-t border-dashed border-gray-200 w-full flex items-start"><span className="text-[9px] text-gray-400 -mt-3.5 bg-white pr-1">{MAX_RESTROOM_Y}</span></div>
                <div className="border-t border-dashed border-gray-200 w-full flex items-start"><span className="text-[9px] text-gray-400 -mt-3.5 bg-white pr-1">{Math.round(MAX_RESTROOM_Y/2)}</span></div>
                <div className="border-t border-gray-300 w-full flex items-start"><span className="text-[9px] text-gray-400 -mt-3.5 bg-white pr-1">0</span></div>
             </div>
             <div className="flex items-end justify-between h-full pb-6 pl-5 gap-1.5 relative z-10">
              {last8Weeks.map((week, idx) => {
                const heightPct = Math.min((week.count / MAX_RESTROOM_Y) * 100, 100);
                return (
                  <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end relative group">
                    <span className={`text-[10px] font-bold mb-1 absolute bottom-full pb-0.5 ${week.count > 0 ? 'text-red-500' : 'text-gray-300'}`}>{week.count}</span>
                    <div className={`w-full rounded-t-md transition-colors border-b-0 ${week.count > 0 ? 'bg-red-400 hover:bg-red-500 shadow-sm' : 'bg-transparent'}`} style={{ height: `${Math.max(heightPct, 1)}%` }}></div>
                    <span className="text-[9px] text-gray-500 absolute -bottom-5 whitespace-nowrap">{week.weekLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderExercise = () => { /* ... 이전 코드와 동일 ... */
     const days = generateCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth());
     const recent7Days = Array.from({length: 7}, (_, i) => getLocalDateString(new Date(Date.now() - i*86400000))).reverse();
 
     const partStats = { '상체': 0, '하체': 0, '전신': 0 };
     let totalExTime = 0;
     recent7Days.forEach(date => {
       getDayLogs(exerciseLogs, date).forEach(log => {
         if(partStats[log.part] !== undefined) partStats[log.part] += log.time;
         totalExTime += log.time;
       });
     });
 
     return (
       <div className="space-y-6 pb-20 animate-fade-in">
         <div className="flex justify-between items-center px-2">
           <button onClick={() => handleMonthChange(-1)} className="p-1"><ChevronLeft/></button>
           <span className="font-bold text-lg">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</span>
           <button onClick={() => handleMonthChange(1)} className="p-1"><ChevronRight/></button>
         </div>
 
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
           <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400 mb-2">
             <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
           </div>
           <div className="grid grid-cols-7 gap-1 text-center">
             {days.map((dateStr, idx) => {
               if (!dateStr) return <div key={`empty-${idx}`} className="h-16"></div>;
               const exList = getDayLogs(exerciseLogs, dateStr);
               return (
                 <div key={dateStr} className={`h-16 border rounded bg-gray-50 flex flex-col p-0.5 overflow-hidden ${dateStr === todayStr ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-100'}`}>
                   <span className="text-[10px] text-gray-500">{parseInt(dateStr.slice(-2), 10)}</span>
                   <div className="flex flex-col gap-0.5 mt-0.5">
                     {exList.slice(0, 2).map((ex, i) => <div key={i} className="text-[8px] bg-indigo-100 text-indigo-700 px-0.5 rounded truncate">{ex.name}</div>)}
                     {exList.length > 2 && <div className="text-[8px] text-gray-400">+{exList.length - 2}</div>}
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
 
         <div className="grid grid-cols-2 gap-4">
           <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
             <h3 className="text-[11px] font-bold text-gray-600 mb-3 text-center">주간 운동 부위 비율</h3>
             <div className="relative w-24 h-24 mx-auto rounded-full shadow-inner" style={{
               background: `conic-gradient(#60a5fa 0% ${(partStats['상체']/totalExTime)*100 || 0}%, #facc15 ${(partStats['상체']/totalExTime)*100 || 0}% ${((partStats['상체']+partStats['하체'])/totalExTime)*100 || 0}%, #f87171 ${((partStats['상체']+partStats['하체'])/totalExTime)*100 || 0}% 100%)`
             }}></div>
             <div className="flex flex-col gap-1 mt-4 text-[10px] items-center">
               <span className="flex items-center"><span className="w-2.5 h-2.5 bg-blue-400 rounded-sm mr-1.5"></span>상체 ({partStats['상체']}분)</span>
               <span className="flex items-center"><span className="w-2.5 h-2.5 bg-yellow-400 rounded-sm mr-1.5"></span>하체 ({partStats['하체']}분)</span>
               <span className="flex items-center"><span className="w-2.5 h-2.5 bg-red-400 rounded-sm mr-1.5"></span>전신 ({partStats['전신']}분)</span>
             </div>
           </div>
           <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-[11px] font-bold text-gray-600 mb-3">최근 7일 운동시간</h3>
              <div className="space-y-1.5">
                {recent7Days.slice().reverse().map(date => {
                  const time = getDayLogs(exerciseLogs, date).reduce((acc, log) => acc + log.time, 0);
                  const bgClass = time === 0 ? 'bg-gray-100 text-gray-400' : time < 30 ? 'bg-indigo-100 text-indigo-700' : time < 60 ? 'bg-indigo-300 text-indigo-900' : 'bg-indigo-500 text-white';
                  return (
                    <div key={date} className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-500">{date.slice(5)}</span>
                      <span className={`px-2 py-0.5 rounded-sm font-medium w-12 text-center ${bgClass}`}>{time}분</span>
                    </div>
                  )
                })}
              </div>
           </div>
         </div>
       </div>
     );
   };
 
  const renderDatabase = () => { /* ... 이전 코드와 동일 ... */
     const handleAddRecipe = (e) => {
       e.preventDefault();
       if(recipeForm.ingredients.length === 0) return alert("재료를 추가해주세요.");
       const totalNutrition = recipeForm.ingredients.reduce((acc, item) => {
         const info = nutritionDB[item.menu];
         return {
           kcal: acc.kcal + (info.kcal * item.qty), carb: acc.carb + (info.carb * item.qty),
           protein: acc.protein + (info.protein * item.qty), fat: acc.fat + (info.fat * item.qty), sugar: acc.sugar + (info.sugar * item.qty)
         };
       }, { kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0 });
       setNutritionDB({...nutritionDB, [recipeForm.name]: {
         kcal: Number(totalNutrition.kcal.toFixed(1)), carb: Number(totalNutrition.carb.toFixed(1)),
         protein: Number(totalNutrition.protein.toFixed(1)), fat: Number(totalNutrition.fat.toFixed(1)), sugar: Number(totalNutrition.sugar.toFixed(1))
       }});
       setRecipeForm({ name: '', ingredients: [] });
       alert("레시피가 저장되었습니다!");
     };
 
     const handleAddSingleItem = (e) => {
       e.preventDefault();
       setNutritionDB({...nutritionDB, [singleItemForm.name]: {
         kcal: Number(singleItemForm.kcal), carb: Number(singleItemForm.carb),
         protein: Number(singleItemForm.protein), fat: Number(singleItemForm.fat), sugar: Number(singleItemForm.sugar)
       }});
       setSingleItemForm({ name: '', kcal: '', carb: '', protein: '', fat: '', sugar: '' });
       alert("개별 재료가 저장되었습니다!");
     };
 
     const handleAddExercise = (e) => {
       e.preventDefault();
       setExerciseDB({...exerciseDB, [newExerciseForm.name]: {
         part: newExerciseForm.part, type: newExerciseForm.type, time: Number(newExerciseForm.time) || 0
       }});
       setNewExerciseForm({ name: '', part: '전신', type: '유산소', time: '' });
       alert("새로운 운동이 DB에 저장되었습니다!");
     };
 
     const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
 
     return (
       <div className="space-y-6 pb-20 animate-fade-in">
         <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={()=>setDbMode('recipe')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${dbMode === 'recipe' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>레시피</button>
            <button onClick={()=>setDbMode('single')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${dbMode === 'single' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500'}`}>식재료</button>
            <button onClick={()=>setDbMode('exercise')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${dbMode === 'exercise' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>운동</button>
         </div>
         
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           {dbMode === 'recipe' && (
             <div className="space-y-6 animate-fade-in">
               <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl">
                 <h3 className="text-sm font-bold text-orange-800 flex items-center mb-2">
                   <Sparkles size={16} className="mr-1" /> AI 냉장고 파먹기 레시피
                 </h3>
                 <p className="text-xs text-orange-600 mb-3">집에 있는 재료를 입력하면 AI가 다이어트 레시피와 영양성분을 만들어줍니다!</p>
                 <div className="flex gap-2">
                   <input type="text" value={aiIngredientsInput} onChange={e => setAiIngredientsInput(e.target.value)} 
                     placeholder="예: 닭가슴살, 양배추, 팽이버섯" 
                     className="flex-1 p-2 bg-white border border-orange-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-300" />
                   <button onClick={getAiRecipe} disabled={isAiRecipeLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap disabled:bg-orange-300">
                     {isAiRecipeLoading ? '생성 중...' : '생성'}
                   </button>
                 </div>
                 
                 {aiRecipeResult && (
                   <div className="mt-4 p-3 bg-white rounded-lg shadow-sm border border-orange-100 animate-slide-up">
                     <h4 className="font-bold text-gray-800 mb-1">{aiRecipeResult.name}</h4>
                     <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">{aiRecipeResult.recipe_desc}</p>
                     <div className="flex flex-wrap gap-2 text-[10px] text-gray-600 mb-3">
                       <span className="bg-gray-100 px-2 py-1 rounded">칼로리: {aiRecipeResult.kcal}kcal</span>
                       <span className="bg-gray-100 px-2 py-1 rounded">탄: {aiRecipeResult.carb}g</span>
                       <span className="bg-gray-100 px-2 py-1 rounded">단: {aiRecipeResult.protein}g</span>
                       <span className="bg-gray-100 px-2 py-1 rounded">지: {aiRecipeResult.fat}g</span>
                     </div>
                     <button onClick={saveAiRecipeToDB} className="w-full bg-gray-900 text-white py-2 text-xs font-bold rounded-md">
                       내 영양정보 DB에 추가하기
                     </button>
                   </div>
                 )}
               </div>
 
               <form onSubmit={handleAddRecipe} className="space-y-4 pt-4 border-t border-gray-100">
                 <div>
                   <label className="text-xs font-semibold text-gray-600 block mb-1">수동 레시피 이름</label>
                   <input type="text" value={recipeForm.name} onChange={e => setRecipeForm({...recipeForm, name: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="예: 양배추 참치 볶음" required />
                 </div>
                 <div className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300">
                   <label className="text-xs font-semibold text-gray-600 block mb-2">기존 재료 추가</label>
                   <div className="flex gap-2 mb-2">
                     <select value={newIngredient.menu} onChange={e => setNewIngredient({...newIngredient, menu: e.target.value})} className="flex-1 p-2 border rounded-md text-sm">
                       {Object.keys(nutritionDB).map(menu => <option key={menu} value={menu}>{menu}</option>)}
                     </select>
                     <input type="number" step="0.5" value={newIngredient.qty} onChange={e => setNewIngredient({...newIngredient, qty: e.target.value})} className="w-16 p-2 border rounded-md text-sm" />
                     <button type="button" onClick={() => {
                       setRecipeForm({...recipeForm, ingredients: [...recipeForm.ingredients, {menu: newIngredient.menu, qty: Number(newIngredient.qty)}]});
                     }} className="bg-blue-100 text-blue-700 px-3 rounded-md text-sm font-bold">+</button>
                   </div>
                   <ul className="space-y-1">
                     {recipeForm.ingredients.map((ing, idx) => (
                       <li key={idx} className="text-xs flex justify-between bg-white p-2 rounded border">
                         <span>{ing.menu}</span> <span className="font-medium text-gray-500">x{ing.qty}</span>
                       </li>
                     ))}
                   </ul>
                 </div>
                 <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">레시피 저장</button>
               </form>
             </div>
           )}
 
           {dbMode === 'single' && (
             <form onSubmit={handleAddSingleItem} className="space-y-3 animate-fade-in">
               <div>
                 <label className="text-xs font-semibold text-gray-600 block mb-1">제품/식재료명</label>
                 <input type="text" value={singleItemForm.name} onChange={e => setSingleItemForm({...singleItemForm, name: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" required />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 {['kcal', 'carb', 'protein', 'fat', 'sugar'].map(field => {
                   const labels = { kcal: '칼로리(kcal)', carb: '탄수화물(g)', protein: '단백질(g)', fat: '지방(g)', sugar: '당류(g)' };
                   return (
                     <div key={field}>
                       <label className="text-[10px] font-semibold text-gray-500 block mb-1">{labels[field]}</label>
                       <input type="number" step="0.1" value={singleItemForm[field]} onChange={e => setSingleItemForm({...singleItemForm, [field]: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" required />
                     </div>
                   )
                 })}
               </div>
               <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-sm mt-4">개별 재료 저장</button>
             </form>
           )}
 
           {dbMode === 'exercise' && (
             <div className="space-y-6 animate-fade-in">
               <form onSubmit={handleAddExercise} className="space-y-3">
                 <h3 className="text-sm font-bold text-gray-800 mb-2">새로운 운동 등록</h3>
                 <div>
                   <label className="text-xs font-semibold text-gray-600 block mb-1">운동명</label>
                   <input type="text" value={newExerciseForm.name} onChange={e => setNewExerciseForm({...newExerciseForm, name: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="예: 요가" required />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="text-[10px] font-semibold text-gray-500 block mb-1">운동 부위</label>
                     <select value={newExerciseForm.part} onChange={e => setNewExerciseForm({...newExerciseForm, part: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg text-sm outline-none">
                       <option value="전신">전신</option><option value="상체">상체</option><option value="하체">하체</option>
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] font-semibold text-gray-500 block mb-1">운동 종류</label>
                     <select value={newExerciseForm.type} onChange={e => setNewExerciseForm({...newExerciseForm, type: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg text-sm outline-none">
                       <option value="유산소">유산소</option><option value="무산소">무산소</option><option value="스트레칭">스트레칭</option>
                     </select>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-600 block mb-1">기본 진행 시간 (선택)</label>
                   <input type="number" value={newExerciseForm.time} onChange={e => setNewExerciseForm({...newExerciseForm, time: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="입력 안할시 자유시간(0분) 저장" />
                 </div>
                 <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl text-sm mt-4">운동 DB에 추가하기</button>
               </form>
 
               <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
                    <Calendar size={16} className="mr-1.5 text-indigo-500"/> 주간 운동 계획 설정
                  </h3>
                  <div className="flex justify-between bg-gray-100 p-1 rounded-lg mb-3">
                    {dayLabels.map((d, i) => (
                      <button key={i} type="button" onClick={() => setSelectedPlanDay(i)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${selectedPlanDay === i ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:bg-gray-200'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 h-48 overflow-y-auto">
                    <p className="text-[10px] text-gray-500 mb-3 font-medium text-center">{dayLabels[selectedPlanDay]}요일에 진행할 운동을 선택하세요.</p>
                    <div className="space-y-2">
                      {Object.keys(exerciseDB).map(ex => {
                        const isChecked = weeklyExercisePlan[selectedPlanDay].includes(ex);
                        return (
                          <label key={ex} className={`flex items-center bg-white p-2.5 rounded-xl border transition-colors cursor-pointer ${isChecked ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                            <input type="checkbox" checked={isChecked} onChange={(e) => {
                              const currentPlan = [...weeklyExercisePlan[selectedPlanDay]];
                              if(e.target.checked) {
                                setWeeklyExercisePlan({...weeklyExercisePlan, [selectedPlanDay]: [...currentPlan, ex]});
                              } else {
                                setWeeklyExercisePlan({...weeklyExercisePlan, [selectedPlanDay]: currentPlan.filter(item => item !== ex)});
                              }
                            }} className="w-4 h-4 text-indigo-600 rounded mr-3" />
                            <span className={`text-xs font-bold ${isChecked ? 'text-indigo-800' : 'text-gray-700'}`}>{ex}</span>
                            <span className="ml-auto text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{exerciseDB[ex].part}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
               </div>
             </div>
           )}
         </div>
         
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2 flex items-center">
             <Database size={16} className="mr-2 text-gray-500"/>{dbMode === 'exercise' ? '등록된 운동 목록' : '영양정보 DB 목록'}
           </h2>
           <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
             {dbMode === 'exercise' 
               ? Object.entries(exerciseDB).reverse().map(([name, info]) => (
                   <div key={name} className="flex justify-between items-center text-sm border-b pb-2">
                     <span className="font-medium text-gray-700 truncate">{name} <span className="text-[10px] bg-gray-100 px-1 rounded ml-1">{info.part}/{info.type}</span></span>
                     <span className="text-[11px] font-bold text-indigo-500">{info.time > 0 ? `${info.time}분` : '자유입력'}</span>
                   </div>
                 ))
               : Object.entries(nutritionDB).reverse().map(([name, info]) => (
                   <div key={name} className="flex justify-between items-center text-sm border-b pb-2">
                     <span className="font-medium text-gray-700 truncate w-[45%]">{name}</span>
                     <span className="text-[10px] text-gray-500 text-right">
                       {info.kcal}kcal<br/>C:{info.carb} P:{info.protein} F:{info.fat} S:{info.sugar}
                     </span>
                   </div>
                 ))
             }
           </div>
         </div>
       </div>
     );
   };
 
  const renderModal = () => { /* ... 이전 코드와 동일 ... */
     if (!isModalOpen) return null;
     return (
       <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-4">
         <div className="bg-white w-full sm:w-96 rounded-2xl p-6 pb-8 shadow-2xl relative animate-slide-up">
           <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X size={20}/></button>
           <h2 className="text-xl font-extrabold text-gray-800 mb-6 flex items-center">
             {modalType === 'diet' ? <><Utensils className="mr-2 text-orange-500"/> 식단 기록</> : 
              modalType === 'weight' ? <><Scale className="mr-2 text-blue-500"/> 체중 기록</> : 
              <><Dumbbell className="mr-2 text-indigo-500"/> 운동 기록</>}
           </h2>
 
           <form onSubmit={submitLog} className="space-y-5">
             {modalType === 'diet' && (
               <>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">식사 분류</label>
                   <select name="meal" value={formData.meal} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-300">
                     <option value="아침">아침</option><option value="점심">점심</option><option value="저녁">저녁</option><option value="간식">간식</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">메뉴명 (DB에서 선택)</label>
                   <select name="menu" value={formData.menu} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-300">
                     {Object.keys(nutritionDB).map(menu => <option key={menu} value={menu}>{menu}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">수량 (개/인분)</label>
                   <input type="number" name="qty" step="0.1" value={formData.qty} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-300" required />
                 </div>
               </>
             )}
 
             {modalType === 'weight' && (
               <>
                 <div className="flex gap-4">
                   <div className="flex-1">
                     <label className="block text-sm font-bold text-gray-700 mb-1">체중 (kg)</label>
                     <input type="number" name="weight" step="0.01" value={formData.weight} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-300" placeholder="0.00" required />
                   </div>
                   <div className="flex-1">
                     <label className="block text-sm font-bold text-gray-700 mb-1">측정 시간</label>
                     <input type="time" name="time" value={formData.time} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-300" required />
                   </div>
                 </div>
                 <div className="flex items-center p-3 bg-red-50 border border-red-100 rounded-xl">
                   <input type="checkbox" name="restroom" id="restroom" checked={formData.restroom} onChange={handleInputChange} className="w-5 h-5 text-red-500 rounded cursor-pointer" />
                   <label htmlFor="restroom" className="ml-3 font-semibold text-red-700 cursor-pointer w-full">화장실 다녀옴 (✔)</label>
                 </div>
               </>
             )}
 
             {modalType === 'exercise' && (
               <>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">운동명 (DB에서 선택)</label>
                   <select name="exerciseName" value={formData.exerciseName} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300">
                     {Object.keys(exerciseDB).map(ex => <option key={ex} value={ex}>{ex} ({exerciseDB[ex].part})</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">진행 시간 (분)</label>
                   <input type="number" name="exTime" value={formData.exTime} onChange={handleInputChange} 
                          placeholder={exerciseDB[formData.exerciseName]?.time === 0 ? "시간을 직접 입력해주세요" : ""}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400" required />
                   {exerciseDB[formData.exerciseName]?.time === 0 && (
                     <p className="text-[10px] text-indigo-500 mt-1">* 자유 운동입니다. 진행 시간을 직접 입력해주세요.</p>
                   )}
                 </div>
               </>
             )}
 
             <button type="submit" className="w-full mt-2 bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition duration-200 text-lg shadow-lg">
               기록 저장
             </button>
           </form>
         </div>
       </div>
     );
   };
 
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-900 flex justify-center">
      <div className="w-full max-w-md bg-slate-50 relative h-screen overflow-y-auto shadow-2xl">
        <header className="bg-white/90 backdrop-blur-md pt-10 pb-4 px-6 sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">
            {activeTab === 'home' && '오늘의 요약'}
            {activeTab === 'diet' && '식단 분석'}
            {activeTab === 'weight' && '체중 관리'}
            {activeTab === 'exercise' && '운동 일지'}
            {activeTab === 'database' && '종합 DB'}
          </h1>
        </header>

        <main className="p-5">
          {activeTab === 'home' && renderDashboard()}
          {activeTab === 'diet' && renderDiet()}
          {activeTab === 'weight' && renderWeight()}
          {activeTab === 'exercise' && renderExercise()}
          {activeTab === 'database' && renderDatabase()}
        </main>

        {activeTab !== 'database' && (
          <div className="fixed bottom-24 right-4 sm:absolute sm:bottom-24 sm:right-6 z-40">
            <button 
              onClick={() => {
                setModalType(activeTab === 'home' ? 'diet' : activeTab);
                if(activeTab === 'exercise') {
                  const firstEx = Object.keys(exerciseDB)[0];
                  setFormData(prev => ({...prev, exerciseName: firstEx, exTime: exerciseDB[firstEx]?.time || '' }));
                }
                setIsModalOpen(true);
              }}
              className="bg-gray-900 hover:bg-black text-white rounded-full p-4 shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            >
              <Plus size={28} strokeWidth={3} />
            </button>
          </div>
        )}

        <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 flex justify-around items-center pb-safe z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {[
            { id: 'home', icon: Home, label: '메인' },
            { id: 'diet', icon: Utensils, label: '식단' },
            { id: 'weight', icon: Scale, label: '체중' },
            { id: 'exercise', icon: Dumbbell, label: '운동' },
            { id: 'database', icon: Database, label: 'DB' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-3 w-full transition-colors ${activeTab === tab.id ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <tab.icon size={22} className={`mb-1 ${activeTab === tab.id ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </button>
          ))}
        </nav>
        {renderModal()}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0;} to { transform: translateY(0); opacity: 1;} }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
      `}} />
    </div>
  );
}



export default App;

return (
  <div className="min-h-screen bg-gray-100 p-4">
    {activeTab === 'home' && renderDashboard()}
    {activeTab === 'diet' && renderDiet()}
    {activeTab === 'weight' && renderWeight()}
    {activeTab === 'exercise' && renderExercise()}
    {activeTab === 'database' && renderDatabase()}
  </div>
);
