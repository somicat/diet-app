import React, { useState, useEffect } from 'react';
import { Home, Utensils, Scale, Dumbbell, Plus, X, Activity, ArrowUp, ArrowDown, Database, Check, ChevronLeft, ChevronRight, Droplets, Calendar, Trash2, Settings, Edit3 } from 'lucide-react';


// 날짜 포맷 유틸
const getLocalDateString = (dateObj) => {
  const d = new Date(dateObj);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const todayStr = getLocalDateString(new Date());

// 로컬 스토리지 초기화 유틸
const getInitialState = (key, defaultValue) => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  }
  return defaultValue;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  const [dbMode, setDbMode] = useState('single'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('diet');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [baseWeight, setBaseWeight] = useState(() => getInitialState('baseWeight', 52.0));
  const [baseDate, setBaseDate] = useState(() => getInitialState('baseDate', todayStr));
  
  // 날짜 선택 상태
  const [selectedDietDate, setSelectedDietDate] = useState(todayStr);
  const [selectedWeightDate, setSelectedWeightDate] = useState(todayStr);
  const [selectedExerciseDate, setSelectedExerciseDate] = useState(todayStr); 
  const [selectedPlanDay, setSelectedPlanDay] = useState(new Date().getDay()); 

  // 기록 수정 관련 상태
  const [editingLogId, setEditingLogId] = useState(null);
  const [modalDate, setModalDate] = useState(todayStr);
  
  // DB 수정 관련 상태
  const [dbEditingKey, setDbEditingKey] = useState(null);

  // 커스텀 알림/확인창 상태
  const [dialog, setDialog] = useState({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  const showAlert = (message) => setDialog({ isOpen: true, type: 'alert', message, onConfirm: null });
  const showConfirm = (message, onConfirm) => setDialog({ isOpen: true, type: 'confirm', message, onConfirm });
  const closeDialog = () => setDialog({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  // --- [데이터 상태 (로컬 스토리지 연동)] ---
  const [dailyGoals, setDailyGoals] = useState(() => getInitialState('dailyGoals', { kcal: 1400, carb: 140, protein: 80, fat: 40, sugar: 25 }));
  const [dDayConfig, setDDayConfig] = useState(() => getInitialState('dDayConfig', { date: todayStr, type: 'start' }));

  const [nutritionDB, setNutritionDB] = useState(() => getInitialState('nutritionDB', {
    "고구마 1개(115g)": { kcal: 159, carb: 37.7, protein: 1.7, fat: 0.2, sugar: 0 },
    "닭가슴살 100g": { kcal: 110, carb: 0, protein: 23, fat: 1, sugar: 0 },
    "양배추 100g": { kcal: 20, carb: 5, protein: 1, fat: 0, sugar: 0 },
    "계란 1개": { kcal: 70, carb: 0.5, protein: 6, fat: 5, sugar: 0 },
    "사과 1개": { kcal: 95, carb: 25, protein: 0.5, fat: 0.3, sugar: 19 },
    "현미밥 1공기": { kcal: 300, carb: 65, protein: 6, fat: 1, sugar: 0 }
  }));

  const [exerciseDB, setExerciseDB] = useState(() => getInitialState('exerciseDB', {
    "러닝": { part: "전신", type: "유산소", time: 30 },
    "스쿼트": { part: "하체", type: "무산소", time: 15 },
    "푸시업": { part: "상체", type: "무산소", time: 10 },
    "폼롤러": { part: "전신", type: "스트레칭", time: 15 },
    "아랫배": { part: "상체", type: "무산소", time: 15 },
    "자유 헬스": { part: "전신", type: "무산소", time: 0 }
  }));

  const [dietLogs, setDietLogs] = useState(() => getInitialState('dietLogs', []));
  const [weightLogs, setWeightLogs] = useState(() => getInitialState('weightLogs', []));
  const [exerciseLogs, setExerciseLogs] = useState(() => getInitialState('exerciseLogs', []));
  const [weeklyExercisePlan, setWeeklyExercisePlan] = useState(() => getInitialState('weeklyExercisePlan', {
    0: [], 1: ['러닝', '스쿼트'], 2: ['푸시업', '아랫배'], 3: ['러닝'], 4: ['스쿼트', '폼롤러'], 5: ['자유 헬스'], 6: []
  }));

  // 데이터 변경 시 로컬 스토리지 자동 저장
  useEffect(() => localStorage.setItem('dailyGoals', JSON.stringify(dailyGoals)), [dailyGoals]);
  useEffect(() => localStorage.setItem('dDayConfig', JSON.stringify(dDayConfig)), [dDayConfig]);
  useEffect(() => localStorage.setItem('nutritionDB', JSON.stringify(nutritionDB)), [nutritionDB]);
  useEffect(() => localStorage.setItem('exerciseDB', JSON.stringify(exerciseDB)), [exerciseDB]);
  useEffect(() => localStorage.setItem('dietLogs', JSON.stringify(dietLogs)), [dietLogs]);
  useEffect(() => localStorage.setItem('weightLogs', JSON.stringify(weightLogs)), [weightLogs]);
  useEffect(() => localStorage.setItem('exerciseLogs', JSON.stringify(exerciseLogs)), [exerciseLogs]);
  useEffect(() => localStorage.setItem('weeklyExercisePlan', JSON.stringify(weeklyExercisePlan)), [weeklyExercisePlan]);

  const [formData, setFormData] = useState({
    meal: '아침', menu: '', qty: 1, weight: '', time: '08:00', restroom: false, memo: '', exerciseName: '', exTime: '',
    ddayType: 'start', ddayDate: todayStr,
    goalKcal: '', goalCarb: '', goalProtein: '', goalFat: '', goalSugar: ''
  });
  const [recipeForm, setRecipeForm] = useState({ name: '', ingredients: [] });
  const [newIngredient, setNewIngredient] = useState({ menu: Object.keys(nutritionDB)[0] || '', qty: 1 });
  const [singleItemForm, setSingleItemForm] = useState({ name: '', kcal: '', carb: '', protein: '', fat: '', sugar: '' });
  const [newExerciseForm, setNewExerciseForm] = useState({ name: '', part: '전신', type: '유산소', time: '' });
    
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'exerciseName') {
      const dbEx = exerciseDB[value];
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

  // --- 통합 모달 관리 (신규 등록 및 수정) ---
  const openModal = (type, existingLog = null, targetDate = todayStr) => {
    setModalType(type);
    setEditingLogId(existingLog ? existingLog.id : null);
    setModalDate(existingLog ? existingLog.date : targetDate);

    if (type === 'dday') {
      setFormData(prev => ({ ...prev, ddayType: dDayConfig.type || 'start', ddayDate: dDayConfig.date || todayStr }));
    } else if (type === 'goals') {
      setFormData(prev => ({ 
        ...prev, goalKcal: dailyGoals.kcal, goalCarb: dailyGoals.carb, goalProtein: dailyGoals.protein, goalFat: dailyGoals.fat, goalSugar: dailyGoals.sugar 
      }));
    } else if (existingLog) {
      setFormData(prev => ({
        ...prev,
        meal: existingLog.meal || '아침',
        menu: existingLog.menu || (Object.keys(nutritionDB)[0] || ''),
        qty: existingLog.qty || 1,
        weight: existingLog.weight || '',
        time: existingLog.time || '08:00',
        restroom: existingLog.restroom || false,
        memo: existingLog.memo || '',
        exerciseName: existingLog.name || (Object.keys(exerciseDB)[0] || ''),
        exTime: existingLog.time !== undefined ? existingLog.time : ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        meal: '아침', menu: Object.keys(nutritionDB)[0] || '', qty: 1,
        weight: '', time: '08:00', restroom: false, memo: '',
        exerciseName: Object.keys(exerciseDB)[0] || '', exTime: ''
      }));
    }
    setIsModalOpen(true);
  };

  // 기록 저장 처리
  const submitLog = (e) => {
    e.preventDefault();
    
    if (modalType === 'dday') {
      setDDayConfig({ type: formData.ddayType, date: formData.ddayDate });
      setIsModalOpen(false);
      return;
    }

    if (modalType === 'goals') {
      setDailyGoals({
        kcal: Number(formData.goalKcal), carb: Number(formData.goalCarb), protein: Number(formData.goalProtein), fat: Number(formData.goalFat), sugar: Number(formData.goalSugar)
      });
      setIsModalOpen(false);
      showAlert("목표 영양소가 업데이트 되었습니다.");
      return;
    }

    const newLogId = editingLogId || Date.now();
    const baseLog = { id: newLogId, date: modalDate };

    if (modalType === 'diet') {
      const data = { ...baseLog, meal: formData.meal, menu: formData.menu, qty: Number(formData.qty) };
      if (editingLogId) setDietLogs(dietLogs.map(l => l.id === editingLogId ? data : l));
      else setDietLogs([...dietLogs, data]);
      
    } else if (modalType === 'weight') {
      const data = { ...baseLog, weight: Number(formData.weight), time: formData.time, restroom: formData.restroom, memo: formData.memo };
      const newArray = editingLogId ? weightLogs.map(l => l.id === editingLogId ? data : l) : [...weightLogs, data];
      setWeightLogs(newArray.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
      
    } else if (modalType === 'exercise') {
      const ex = exerciseDB[formData.exerciseName];
      const data = { ...baseLog, name: formData.exerciseName, time: Number(formData.exTime), part: ex?.part || '전신' };
      if (editingLogId) setExerciseLogs(exerciseLogs.map(l => l.id === editingLogId ? data : l));
      else setExerciseLogs([...exerciseLogs, data]);
    }
    setIsModalOpen(false);
  };

  // 기록 삭제 처리 (커스텀 컨펌 사용)
  const deleteLog = () => {
    showConfirm("정말 이 기록을 삭제하시겠습니까?", () => {
      if (modalType === 'diet') setDietLogs(dietLogs.filter(l => l.id !== editingLogId));
      else if (modalType === 'weight') setWeightLogs(weightLogs.filter(l => l.id !== editingLogId));
      else if (modalType === 'exercise') setExerciseLogs(exerciseLogs.filter(l => l.id !== editingLogId));
      setIsModalOpen(false);
      closeDialog();
    });
  };

  // --- 통합 DB 항목 수정 및 삭제 ---
  const handleEditDbItem = (type, key, info) => {
    setDbEditingKey(key);
    if (type === 'exercise') {
      setDbMode('exercise');
      setNewExerciseForm({ name: key, part: info.part, type: info.type, time: info.time || '' });
    } else {
      setDbMode('single');
      setSingleItemForm({ name: key, kcal: info.kcal, carb: info.carb, protein: info.protein, fat: info.fat, sugar: info.sugar });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelDbEdit = () => {
    setDbEditingKey(null);
    setSingleItemForm({ name: '', kcal: '', carb: '', protein: '', fat: '', sugar: '' });
    setNewExerciseForm({ name: '', part: '전신', type: '유산소', time: '' });
  };

  const handleDeleteDbItem = () => {
    showConfirm("정말 이 데이터를 삭제하시겠습니까?\n(기존 기록들의 정보가 부정확해질 수 있습니다)", () => {
      if (dbMode === 'exercise') {
        const newDB = {...exerciseDB};
        delete newDB[dbEditingKey];
        setExerciseDB(newDB);
      } else {
        const newDB = {...nutritionDB};
        delete newDB[dbEditingKey];
        setNutritionDB(newDB);
      }
      cancelDbEdit();
      closeDialog();
    });
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

  // --- D-day 계산 로직 ---
  const getDdayInfo = () => {
    if (!dDayConfig.date) return { text: "D-Day", subText: "다이어트 시작한지" };
    
    const today = new Date(todayStr);
    const target = new Date(dDayConfig.date);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (dDayConfig.type === 'start') {
      const passed = -diffDays;
      if (passed < 0) return { text: `D${passed}`, subText: "다이어트 시작 전" }; 
      if (passed === 0) return { text: "D-Day", subText: "다이어트 시작한지" };
      return { text: `D+${passed}`, subText: "다이어트 시작한지" };
    } else { 
      if (diffDays < 0) return { text: `D+${-diffDays}`, subText: "목표일 지남" };
      if (diffDays === 0) return { text: "D-Day", subText: "다이어트 목표까지" };
      return { text: `D-${diffDays}`, subText: "다이어트 목표까지" };
    }
  };

  // ============================
  // 헤더 렌더링 함수
  // ============================
  const renderHeader = () => {
    let title = '';
    let buttonConfig = null;

    if (activeTab === 'home') title = '오늘의 요약';
    else if (activeTab === 'database') title = '종합 DB';
    else if (activeTab === 'diet') {
      title = '식단 분석';
      buttonConfig = { label: '식단 기록', type: 'diet', date: selectedDietDate };
    }
    else if (activeTab === 'weight') {
      title = '체중 관리';
      buttonConfig = { label: '체중 기록', type: 'weight', date: selectedWeightDate };
    }
    else if (activeTab === 'exercise') {
      title = '운동 일지';
      buttonConfig = { label: '운동 기록', type: 'exercise', date: selectedExerciseDate };
    }

    return (
      <header className="bg-white/90 backdrop-blur-md pt-10 pb-4 px-6 sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex justify-between items-center">
        <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">
          {title}
        </h1>
        {buttonConfig && (
          <button 
            onClick={() => openModal(buttonConfig.type, null, buttonConfig.date)}
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
          >
            <Edit3 size={16} />
            {buttonConfig.label}
          </button>
        )}
      </header>
    );
  };

  // ============================
  // 각 탭 렌더링 함수
  // ============================

  const renderDashboard = () => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayIdx = new Date().getDay();
    const todaysPlan = weeklyExercisePlan[todayIdx] || [];
    const dDayInfo = getDdayInfo();

    return (
      <div className="space-y-4 pb-20 animate-fade-in flex flex-col items-center">
        <div className="grid grid-cols-2 gap-4 w-full mb-1">
          <div onClick={() => openModal('dday')} className="h-32 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col justify-center items-center relative cursor-pointer hover:bg-gray-50 transition-colors group">
            <span className="text-3xl font-black tracking-tight mb-2 text-blue-600">{dDayInfo.text}</span>
            <span className="text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full group-hover:bg-blue-100 transition-colors">{dDayInfo.subText}</span>
            <Calendar size={14} className="absolute top-3 right-3 text-gray-300 group-hover:text-blue-500 transition-colors" />
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

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 w-full relative">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center"><Activity size={16} className="mr-1 text-red-500"/> 남은 영양소 (오늘)</h3>
            <button onClick={() => openModal('goals')} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1.5 rounded-lg border border-gray-100 transition-colors">
              <Settings size={14} />
            </button>
          </div>
          {[
            { label: '칼로리', cur: todayMacros.kcal, max: dailyGoals.kcal, unit: 'kcal', color: 'bg-red-400' },
            { label: '탄수화물', cur: todayMacros.carb, max: dailyGoals.carb, unit: 'g', color: 'bg-blue-400' },
            { label: '단백질', cur: todayMacros.protein, max: dailyGoals.protein, unit: 'g', color: 'bg-green-400' },
            { label: '지방', cur: todayMacros.fat, max: dailyGoals.fat, unit: 'g', color: 'bg-yellow-400' },
            { label: '첨가당', cur: todayMacros.sugar, max: dailyGoals.sugar, unit: 'g', color: 'bg-purple-400' }
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
      </div>
    );
  }

  const renderDiet = () => { 
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
                        <li key={log.id} onClick={() => openModal('diet', log, selectedDietDate)} 
                            className="flex justify-between text-xs items-center bg-gray-50 p-1.5 rounded cursor-pointer hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
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
                    <th className="p-1.5">구분</th><th className="p-1.5">칼로리</th><th className="p-1.5">탄수화물</th>
                    <th className="p-1.5">단백질</th><th className="p-1.5">지방</th><th className="p-1.5">첨가당</th>
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
                      { cur: selectedMacros.kcal, max: dailyGoals.kcal }, { cur: selectedMacros.carb, max: dailyGoals.carb },
                      { cur: selectedMacros.protein, max: dailyGoals.protein }, { cur: selectedMacros.fat, max: dailyGoals.fat },
                      { cur: selectedMacros.sugar, max: dailyGoals.sugar }
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

  const renderWeight = () => { 
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

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <h3 className="font-bold text-gray-800 text-sm mb-3">상세 기록 <span className="text-[10px] text-gray-400 font-normal ml-1">(클릭하여 수정)</span></h3>
           {tLogs.length > 0 ? (
             <div className="space-y-2">
               {tLogs.map(log => (
                 <div key={log.id} onClick={() => openModal('weight', log, selectedWeightDate)} 
                      className="flex flex-col p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 border border-gray-100 transition-colors">
                   <div className="flex justify-between items-center mb-1">
                     <span className="text-sm text-gray-600 font-medium">{log.time}</span>
                     <div className="flex items-center gap-3">
                       <span className="font-bold text-blue-600">{log.weight} kg</span>
                       {log.restroom && <Check size={16} className="text-red-500" strokeWidth={3}/>}
                     </div>
                   </div>
                   {log.memo && <div className="text-xs text-gray-500 bg-white p-2 rounded border border-gray-100 mt-1">{log.memo}</div>}
                 </div>
               ))}
             </div>
           ) : <p className="text-xs text-gray-400 text-center py-2">해당 날짜에 기록이 없습니다.</p>}
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

  const renderExercise = () => { 
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

     const selectedExLogs = getDayLogs(exerciseLogs, selectedExerciseDate);
 
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
               const isSelected = dateStr === selectedExerciseDate;
               return (
                 <div key={dateStr} onClick={() => setSelectedExerciseDate(dateStr)} 
                      className={`h-16 border rounded bg-gray-50 flex flex-col p-0.5 overflow-hidden cursor-pointer transition-colors
                      ${isSelected ? 'border-indigo-400 bg-indigo-50/50 shadow-inner' : 'border-gray-100 hover:bg-gray-100'}`}>
                   <span className={`text-[10px] ${isSelected ? 'text-indigo-700 font-bold' : 'text-gray-500'}`}>{parseInt(dateStr.slice(-2), 10)}</span>
                   <div className="flex flex-col gap-0.5 mt-0.5">
                     {exList.slice(0, 2).map((ex, i) => <div key={i} className="text-[8px] bg-indigo-100 text-indigo-700 px-0.5 rounded truncate">{ex.name}</div>)}
                     {exList.length > 2 && <div className="text-[8px] text-gray-400">+{exList.length - 2}</div>}
                   </div>
                 </div>
               );
             })}
           </div>
         </div>

         <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
                <h2 className="font-bold text-indigo-800 flex items-center"><Dumbbell size={18} className="mr-2"/>{selectedExerciseDate.slice(5)} 운동 기록</h2>
            </div>
            <div className="p-4">
                {selectedExLogs.length > 0 ? (
                    <ul className="space-y-2">
                        {selectedExLogs.map(log => (
                            <li key={log.id} onClick={() => openModal('exercise', log, selectedExerciseDate)} 
                                className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors">
                                <span className="font-bold text-gray-800 text-sm flex items-center">
                                    {log.name} <span className="ml-2 text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">{log.part}</span>
                                </span>
                                <span className="text-xs font-bold text-indigo-500">{log.time}분</span>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-xs text-gray-400 text-center py-2">해당 날짜에 운동 기록이 없습니다.</p>}
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
 
  const renderDatabase = () => { 
     const handleAddRecipe = (e) => {
       e.preventDefault();
       if(recipeForm.ingredients.length === 0) return showAlert("재료를 추가해주세요.");
       const totalNutrition = recipeForm.ingredients.reduce((acc, item) => {
         const info = nutritionDB[item.menu];
         return {
           kcal: acc.kcal + (info.kcal * item.qty), carb: acc.carb + (info.carb * item.qty),
           protein: acc.protein + (info.protein * item.qty), fat: acc.fat + (info.fat * item.qty), sugar: acc.sugar + (info.sugar * item.qty)
         };
       }, { kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0 });
       
       const newDB = {...nutritionDB};
       if(dbEditingKey && dbEditingKey !== recipeForm.name) delete newDB[dbEditingKey];
       newDB[recipeForm.name] = {
         kcal: Number(totalNutrition.kcal.toFixed(1)), carb: Number(totalNutrition.carb.toFixed(1)),
         protein: Number(totalNutrition.protein.toFixed(1)), fat: Number(totalNutrition.fat.toFixed(1)), sugar: Number(totalNutrition.sugar.toFixed(1))
       };
       setNutritionDB(newDB);
       setRecipeForm({ name: '', ingredients: [] });
       setDbEditingKey(null);
       showAlert("레시피가 저장되었습니다!");
     };
 
     const handleAddSingleItem = (e) => {
       e.preventDefault();
       const newDB = {...nutritionDB};
       if(dbEditingKey && dbEditingKey !== singleItemForm.name) delete newDB[dbEditingKey];
       newDB[singleItemForm.name] = {
         kcal: Number(singleItemForm.kcal), carb: Number(singleItemForm.carb),
         protein: Number(singleItemForm.protein), fat: Number(singleItemForm.fat), sugar: Number(singleItemForm.sugar)
       };
       setNutritionDB(newDB);
       setSingleItemForm({ name: '', kcal: '', carb: '', protein: '', fat: '', sugar: '' });
       setDbEditingKey(null);
       showAlert(dbEditingKey ? "식재료가 수정되었습니다!" : "개별 재료가 저장되었습니다!");
     };
 
     const handleAddExercise = (e) => {
       e.preventDefault();
       const newDB = {...exerciseDB};
       if(dbEditingKey && dbEditingKey !== newExerciseForm.name) delete newDB[dbEditingKey];
       newDB[newExerciseForm.name] = {
         part: newExerciseForm.part, type: newExerciseForm.type, time: Number(newExerciseForm.time) || 0
       };
       setExerciseDB(newDB);
       setNewExerciseForm({ name: '', part: '전신', type: '유산소', time: '' });
       setDbEditingKey(null);
       showAlert(dbEditingKey ? "운동 DB가 수정되었습니다!" : "새로운 운동이 DB에 저장되었습니다!");
     };
 
     const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
 
     return (
       <div className="space-y-6 pb-20 animate-fade-in">
         <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={()=>{cancelDbEdit(); setDbMode('recipe');}} className={`flex-1 py-2 text-xs font-bold rounded-lg ${dbMode === 'recipe' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>레시피 등록</button>
            <button onClick={()=>{cancelDbEdit(); setDbMode('single');}} className={`flex-1 py-2 text-xs font-bold rounded-lg ${dbMode === 'single' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500'}`}>{dbEditingKey ? '식재료 수정' : '식재료 등록'}</button>
            <button onClick={()=>{cancelDbEdit(); setDbMode('exercise');}} className={`flex-1 py-2 text-xs font-bold rounded-lg ${dbMode === 'exercise' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>{dbEditingKey ? '운동 수정' : '운동 등록'}</button>
         </div>
         
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           {dbMode === 'recipe' && (
             <div className="space-y-6 animate-fade-in">
               <form onSubmit={handleAddRecipe} className="space-y-4">
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
                   const labels = { kcal: '칼로리(kcal)', carb: '탄수화물(g)', protein: '단백질(g)', fat: '지방(g)', sugar: '첨가당(g)' };
                   return (
                     <div key={field}>
                       <label className="text-[10px] font-semibold text-gray-500 block mb-1">{labels[field]}</label>
                       <input type="number" step="0.1" value={singleItemForm[field]} onChange={e => setSingleItemForm({...singleItemForm, [field]: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" required />
                     </div>
                   )
                 })}
               </div>
               <div className="flex gap-2 mt-4">
                 {dbEditingKey && (
                    <button type="button" onClick={handleDeleteDbItem} className="w-1/4 bg-red-100 text-red-600 font-bold py-3 rounded-xl text-sm flex justify-center items-center"><Trash2 size={16}/></button>
                 )}
                 {dbEditingKey && (
                    <button type="button" onClick={cancelDbEdit} className="w-1/4 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm">취소</button>
                 )}
                 <button type="submit" className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl text-sm">{dbEditingKey ? '수정 완료' : '재료 저장'}</button>
               </div>
             </form>
           )}
 
           {dbMode === 'exercise' && (
             <div className="space-y-6 animate-fade-in">
               <form onSubmit={handleAddExercise} className="space-y-3">
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
                 <div className="flex gap-2 mt-4">
                   {dbEditingKey && (
                      <button type="button" onClick={handleDeleteDbItem} className="w-1/4 bg-red-100 text-red-600 font-bold py-3 rounded-xl text-sm flex justify-center items-center"><Trash2 size={16}/></button>
                   )}
                   {dbEditingKey && (
                      <button type="button" onClick={cancelDbEdit} className="w-1/4 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm">취소</button>
                   )}
                   <button type="submit" className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl text-sm">{dbEditingKey ? '운동 정보 수정' : '운동 추가하기'}</button>
                 </div>
               </form>
 
               {!dbEditingKey && (
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
                          const isChecked = weeklyExercisePlan[selectedPlanDay]?.includes(ex) || false;
                          return (
                            <label key={ex} className={`flex items-center bg-white p-2.5 rounded-xl border transition-colors cursor-pointer ${isChecked ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                              <input type="checkbox" checked={isChecked} onChange={(e) => {
                                const currentPlan = weeklyExercisePlan[selectedPlanDay] ? [...weeklyExercisePlan[selectedPlanDay]] : [];
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
               )}
             </div>
           )}
         </div>
         
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           <h2 className="text-base font-bold text-gray-800 mb-2 border-b pb-2 flex items-center justify-between">
             <span className="flex items-center"><Database size={16} className="mr-2 text-gray-500"/>{dbMode === 'exercise' ? '등록된 운동 목록' : '영양정보 DB 목록'}</span>
           </h2>
           <p className="text-[10px] text-gray-400 mb-3 ml-6 font-medium">항목을 클릭하여 수정/삭제할 수 있습니다.</p>
           <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
             {dbMode === 'exercise' 
               ? Object.entries(exerciseDB).reverse().map(([name, info]) => (
                   <div key={name} onClick={() => handleEditDbItem('exercise', name, info)} className="flex justify-between items-center text-sm border-b pb-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                     <span className="font-medium text-gray-700 truncate">{name} <span className="text-[10px] bg-gray-100 px-1 rounded ml-1">{info.part}/{info.type}</span></span>
                     <span className="text-[11px] font-bold text-indigo-500">{info.time > 0 ? `${info.time}분` : '자유입력'}</span>
                   </div>
                 ))
               : Object.entries(nutritionDB).reverse().map(([name, info]) => (
                   <div key={name} onClick={() => handleEditDbItem('single', name, info)} className="flex justify-between items-center text-sm border-b pb-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
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
 
  const renderModal = () => { 
     if (!isModalOpen) return null;
     return (
       <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-4">
         <div className="bg-white w-full sm:w-96 rounded-2xl p-6 pb-8 shadow-2xl relative animate-slide-up">
           <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X size={20}/></button>
           <h2 className="text-xl font-extrabold text-gray-800 mb-6 flex items-center">
             {modalType === 'dday' ? <><Calendar className="mr-2 text-blue-500"/> 디데이 설정</> : 
              modalType === 'goals' ? <><Settings className="mr-2 text-gray-700"/> 목표 영양소 설정</> :
              modalType === 'diet' ? <><Utensils className="mr-2 text-orange-500"/> 식단 {editingLogId ? '수정' : '기록'}</> : 
              modalType === 'weight' ? <><Scale className="mr-2 text-blue-500"/> 체중 {editingLogId ? '수정' : '기록'}</> : 
              <><Dumbbell className="mr-2 text-indigo-500"/> 운동 {editingLogId ? '수정' : '기록'}</>}
           </h2>
 
           <form onSubmit={submitLog} className="space-y-5">
             {modalType === 'dday' && (
               <>
                 <div className="flex gap-2 mb-4">
                   <button type="button" onClick={() => setFormData({...formData, ddayType: 'start'})} 
                           className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${formData.ddayType === 'start' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                     다이어트 시작일
                   </button>
                   <button type="button" onClick={() => setFormData({...formData, ddayType: 'goal'})} 
                           className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${formData.ddayType === 'goal' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                     다이어트 목표일
                   </button>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">날짜 선택</label>
                   <input type="date" name="ddayDate" value={formData.ddayDate} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-300" required />
                 </div>
               </>
             )}

             {modalType === 'goals' && (
               <div className="space-y-3">
                 <div className="flex justify-between items-center gap-4">
                   <label className="text-sm font-bold text-gray-700 w-24">목표 칼로리</label>
                   <input type="number" name="goalKcal" value={formData.goalKcal} onChange={handleInputChange} className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-300" required />
                   <span className="text-xs text-gray-500 w-8">kcal</span>
                 </div>
                 <div className="flex justify-between items-center gap-4">
                   <label className="text-sm font-bold text-gray-700 w-24">탄수화물</label>
                   <input type="number" name="goalCarb" value={formData.goalCarb} onChange={handleInputChange} className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-300" required />
                   <span className="text-xs text-gray-500 w-8">g</span>
                 </div>
                 <div className="flex justify-between items-center gap-4">
                   <label className="text-sm font-bold text-gray-700 w-24">단백질</label>
                   <input type="number" name="goalProtein" value={formData.goalProtein} onChange={handleInputChange} className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-300" required />
                   <span className="text-xs text-gray-500 w-8">g</span>
                 </div>
                 <div className="flex justify-between items-center gap-4">
                   <label className="text-sm font-bold text-gray-700 w-24">지방</label>
                   <input type="number" name="goalFat" value={formData.goalFat} onChange={handleInputChange} className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-300" required />
                   <span className="text-xs text-gray-500 w-8">g</span>
                 </div>
                 <div className="flex justify-between items-center gap-4">
                   <label className="text-sm font-bold text-gray-700 w-24">첨가당</label>
                   <input type="number" name="goalSugar" value={formData.goalSugar} onChange={handleInputChange} className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-300" required />
                   <span className="text-xs text-gray-500 w-8">g</span>
                 </div>
               </div>
             )}

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
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">메모 (선택)</label>
                   <input type="text" name="memo" value={formData.memo} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-300 placeholder-gray-400" placeholder="예: 어제 야식 먹음, 생리 시작 등" />
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
 
             <div className="flex gap-3 mt-4">
                {editingLogId && modalType !== 'dday' && modalType !== 'goals' && (
                  <button type="button" onClick={deleteLog} className="w-1/4 bg-red-100 hover:bg-red-200 text-red-600 font-bold py-4 rounded-xl transition duration-200 flex justify-center items-center">
                    <Trash2 size={20} />
                  </button>
                )}
                <button type="submit" className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition duration-200 text-lg shadow-lg">
                  {modalType === 'dday' || modalType === 'goals' ? '설정 저장' : (editingLogId ? '수정 완료' : '기록 저장')}
                </button>
             </div>
           </form>
         </div>
       </div>
     );
   };
 
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-900 flex justify-center relative">
      <div className="w-full max-w-md bg-slate-50 relative h-screen overflow-y-auto shadow-2xl">
        {renderHeader()}

        <main className="p-5">
          {activeTab === 'home' && renderDashboard()}
          {activeTab === 'diet' && renderDiet()}
          {activeTab === 'weight' && renderWeight()}
          {activeTab === 'exercise' && renderExercise()}
          {activeTab === 'database' && renderDatabase()}
        </main>

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

      {/* --- 커스텀 다이얼로그 (확인창/안림창) --- */}
      {dialog.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex justify-center items-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-2xl text-center transform scale-100 transition-transform">
            <p className="text-gray-800 text-sm font-bold mb-6 whitespace-pre-line leading-relaxed">{dialog.message}</p>
            <div className="flex gap-3 justify-center">
              {dialog.type === 'confirm' && (
                <button onClick={closeDialog} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors">
                  취소
                </button>
              )}
              <button onClick={() => { if(dialog.onConfirm) dialog.onConfirm(); else closeDialog(); }} 
                      className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-colors shadow-md">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0;} to { transform: translateY(0); opacity: 1;} }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
      `}} />
    </div>
  );
}
