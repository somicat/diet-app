import React, { useState, useEffect, useRef } from 'react';
import Papa from "papaparse";
import { Home, Utensils, Scale, Dumbbell, Plus, X, Activity, ArrowUp, ArrowDown, Database, Check, ChevronLeft, ChevronRight, Droplets, Calendar, Trash2, Settings, Edit3 } from 'lucide-react';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { auth, db } from './firebase';


// 날짜 포맷 유틸
const getLocalDateString = (dateObj) => {
  const d = new Date(dateObj);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const todayStr = getLocalDateString(new Date());

const normalizeSearchTerm = (value = '') => value.trim().toLowerCase();
const makeDbDocId = (name = '') => encodeURIComponent(normalizeSearchTerm(name)).replace(/\./g, '%2E');

const APP_INITIALIZED_KEY = 'healthLogInitialized';
const EMPTY_WEEKLY_PLAN = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

const EMPTY_APP_DEFAULTS = {
  baseWeight: '',
  dailyGoals: { kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0 },
  nutritionDB: {},
  exerciseDB: {},
  dietLogs: [],
  weightLogs: [],
  exerciseLogs: [],
  weeklyExercisePlan: EMPTY_WEEKLY_PLAN,
};

const USER_SCOPED_STORAGE_KEYS = [
  'baseWeight',
  'dailyGoals',
  'dDayConfig',
  'nutritionDB',
  'exerciseDB',
  'dietLogs',
  'weightLogs',
  'exerciseLogs',
  'weeklyExercisePlan',
];

const WEIGHT_CHART_LINE = "#848b96";
const CHART_MINT = "#5eead4";
const RESTROOM_RED = "#f87171";
const DDAY_BLUE = "#60a5fa";

const getDefaultDDayConfig = () => ({ startDate: todayStr, goalDate: '' });

const getDefaultAppData = () => ({
  baseWeight: EMPTY_APP_DEFAULTS.baseWeight,
  dailyGoals: EMPTY_APP_DEFAULTS.dailyGoals,
  dDayConfig: getDefaultDDayConfig(),
  nutritionDB: EMPTY_APP_DEFAULTS.nutritionDB,
  exerciseDB: EMPTY_APP_DEFAULTS.exerciseDB,
  dietLogs: EMPTY_APP_DEFAULTS.dietLogs,
  weightLogs: EMPTY_APP_DEFAULTS.weightLogs,
  exerciseLogs: EMPTY_APP_DEFAULTS.exerciseLogs,
  weeklyExercisePlan: EMPTY_APP_DEFAULTS.weeklyExercisePlan,
});

const makeUserStorageKey = (uid, key) => `healthLog:${uid}:${key}`;

const normalizeDDayConfig = (saved) => {
  if (!saved) return getDefaultDDayConfig();
  if (saved.date && saved.type) return { startDate: saved.date, goalDate: '' };
  return { ...getDefaultDDayConfig(), ...saved };
};

const getUserStoredState = (uid, key, defaultValue) => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(makeUserStorageKey(uid, key));
    if (saved !== null) return JSON.parse(saved);
  }
  return defaultValue;
};

const getUserStoredAppData = (uid) => {
  const defaults = getDefaultAppData();
  if (!uid) return defaults;

  return USER_SCOPED_STORAGE_KEYS.reduce((acc, key) => {
    const value = getUserStoredState(uid, key, acc[key]);
    return {
      ...acc,
      [key]: key === 'dDayConfig' ? normalizeDDayConfig(value) : value,
    };
  }, defaults);
};

const USER_SETTINGS_DOC_ID = 'profile';
const NUTRITION_FIELDS = ['kcal', 'carb', 'protein', 'fat', 'sugar'];
const FIRESTORE_BATCH_LIMIT = 450;
const NUTRITION_INPUT_PATTERN = /^-?\d+(?:\.\d+)?(\s*~\s*-?\d+(?:\.\d+)?)?$/;

const sanitizeNutritionInputString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';

  let str = String(value).trim();
  str = str.replace(/[～〜﹏]/g, '~');
  str = str.replace(/(\d(?:\.\d+)?)\s*[-–—]\s*(\d(?:\.\d+)?)/g, '$1~$2');
  str = str.replace(/(\d),(\d+)/g, '$1.$2');
  return str.replace(/\s+/g, ' ').trim();
};

const isValidNutritionInput = (value) => {
  const str = sanitizeNutritionInputString(value);
  return Boolean(str) && NUTRITION_INPUT_PATTERN.test(str);
};

const formatNutritionFieldForInput = (value) =>
  value === null || value === undefined ? '' : sanitizeNutritionInputString(value);

const stripUndefined = (obj) => {
  if (obj === undefined) return undefined;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);

  const ctor = obj?.constructor?.name;
  if (ctor && ctor !== 'Object') return obj;

  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    acc[key] = stripUndefined(value);
    return acc;
  }, {});
};

const normalizeRangeInput = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const str = sanitizeNutritionInputString(value);
  if (!str) return 0;

  const rangeMatch = str.match(/^(-?\d+(?:\.\d+)?)\s*~\s*(-?\d+(?:\.\d+)?)$/);
  if (rangeMatch) return `${Number(rangeMatch[1])}~${Number(rangeMatch[2])}`;

  const numericMatch = str.match(/^-?\d+(?:\.\d+)?/);
  return numericMatch ? Number(numericMatch[0]) : 0;
};

const getNutritionValue = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const str = sanitizeNutritionInputString(value);
  if (!str) return 0;

  const rangeMatch = str.match(/^(-?\d+(?:\.\d+)?)\s*~\s*(-?\d+(?:\.\d+)?)$/);
  if (rangeMatch) return (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2;

  const numericMatch = str.match(/^-?\d+(?:\.\d+)?/);
  return numericMatch ? Number(numericMatch[0]) : 0;
};

const normalizeNutritionInfo = (info = {}) =>
  NUTRITION_FIELDS.reduce((acc, field) => ({
    ...acc,
    [field]: normalizeRangeInput(info[field]),
  }), {});

const formatRemainder = (max, cur) => {
  const diff = getNutritionValue(max) - getNutritionValue(cur);
  const absVal = Math.abs(diff).toFixed(1);
  if (diff < 0) return `-${absVal}`;
  return absVal;
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); 
  const [dbMode, setDbMode] = useState('single'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('diet');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthPicker, setMonthPicker] = useState({ isOpen: false, tab: null, year: new Date().getFullYear(), month: new Date().getMonth() });

  // 사용자가 직접 설정하는 기준 체중
  const [baseWeight, setBaseWeight] = useState(EMPTY_APP_DEFAULTS.baseWeight);
  
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
  const [currentUser, setCurrentUser] = useState(null);
  const [storageUserId, setStorageUserId] = useState(null);
  const [isFirestoreReady, setIsFirestoreReady] = useState(false);
  const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [showAuthModal, setShowAuthModal] = useState(false);
const [lastBackupTime, setLastBackupTime] = useState(
  () => localStorage.getItem("lastBackupTime") || ""
);
  const [sharedSearchTerm, setSharedSearchTerm] = useState('');
  const [sharedResults, setSharedResults] = useState([]);
  const [isSharedLoading, setIsSharedLoading] = useState(false);
  const [publishToSharedDb, setPublishToSharedDb] = useState(true);
  const cloudSyncGeneration = useRef(0);

  // 커스텀 알림/확인창 상태
  const [dialog, setDialog] = useState({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  const showAlert = (message) => setDialog({ isOpen: true, type: 'alert', message, onConfirm: null });
  const showConfirm = (message, onConfirm) => setDialog({ isOpen: true, type: 'confirm', message, onConfirm });
  const closeDialog = () => setDialog({ isOpen: false, type: 'alert', message: '', onConfirm: null });

const handleSignup = async () => {
  try {
    await createUserWithEmailAndPassword(auth, email, password);

    setShowAuthModal(false);

    showAlert("회원가입 성공");
  } catch (error) {
    console.error(error);
    showAlert(error.message);
  }
};

const handleLogin = async () => {
  try {
    await signInWithEmailAndPassword(auth, email, password);

    setShowAuthModal(false);

    showAlert("로그인 성공");
  } catch (error) {
    console.error(error);
    showAlert(error.message);
  }
};

const handleLogout = async () => {
  try {
    await signOut(auth);
    setEmail("");
setPassword("");

    showAlert("로그아웃 되었습니다.");
  } catch (error) {
    console.error(error);
  }
};
  // --- [데이터 상태 (로컬 스토리지 연동)] ---
  const [dailyGoals, setDailyGoals] = useState(EMPTY_APP_DEFAULTS.dailyGoals);
  
  // 디데이 통합 관리 (시작일, 목표일)
  const [dDayConfig, setDDayConfig] = useState(getDefaultDDayConfig);

  const [nutritionDB, setNutritionDB] = useState(EMPTY_APP_DEFAULTS.nutritionDB);
  const [exerciseDB, setExerciseDB] = useState(EMPTY_APP_DEFAULTS.exerciseDB);
  const [dietLogs, setDietLogs] = useState(EMPTY_APP_DEFAULTS.dietLogs);
  const [weightLogs, setWeightLogs] = useState(EMPTY_APP_DEFAULTS.weightLogs);
  const [exerciseLogs, setExerciseLogs] = useState(EMPTY_APP_DEFAULTS.exerciseLogs);
  const [weeklyExercisePlan, setWeeklyExercisePlan] = useState(EMPTY_APP_DEFAULTS.weeklyExercisePlan);

  const applyAppData = (data) => {
    setBaseWeight(data.baseWeight);
    setDailyGoals(data.dailyGoals);
    setDDayConfig(normalizeDDayConfig(data.dDayConfig));
    setNutritionDB(data.nutritionDB);
    setExerciseDB(data.exerciseDB);
    setDietLogs(data.dietLogs);
    setWeightLogs(data.weightLogs);
    setExerciseLogs(data.exerciseLogs);
    setWeeklyExercisePlan(data.weeklyExercisePlan);
    setSelectedDietDate(todayStr);
    setSelectedWeightDate(todayStr);
    setSelectedExerciseDate(todayStr);
    setCurrentMonth(new Date());
    setEditingLogId(null);
    setDbEditingKey(null);
  };

  const saveUserScopedState = (key, value) => {
    if (!currentUser?.uid || storageUserId !== currentUser.uid) return;
    localStorage.setItem(makeUserStorageKey(currentUser.uid, key), JSON.stringify(value));
  };

  // 데이터 변경 시 로컬 스토리지 자동 저장
  useEffect(() => saveUserScopedState('dailyGoals', dailyGoals), [currentUser, storageUserId, dailyGoals]);
  useEffect(() => saveUserScopedState('dDayConfig', dDayConfig), [currentUser, storageUserId, dDayConfig]);
  useEffect(() => saveUserScopedState('nutritionDB', nutritionDB), [currentUser, storageUserId, nutritionDB]);
  useEffect(() => saveUserScopedState('exerciseDB', exerciseDB), [currentUser, storageUserId, exerciseDB]);
  useEffect(() => saveUserScopedState('dietLogs', dietLogs), [currentUser, storageUserId, dietLogs]);
  useEffect(() => saveUserScopedState('weightLogs', weightLogs), [currentUser, storageUserId, weightLogs]);
  useEffect(() => saveUserScopedState('exerciseLogs', exerciseLogs), [currentUser, storageUserId, exerciseLogs]);
  useEffect(() => saveUserScopedState('weeklyExercisePlan', weeklyExercisePlan), [currentUser, storageUserId, weeklyExercisePlan]);
  useEffect(() => saveUserScopedState('baseWeight', baseWeight), [currentUser, storageUserId, baseWeight]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(APP_INITIALIZED_KEY)) {
      localStorage.setItem(APP_INITIALIZED_KEY, 'true');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    cloudSyncGeneration.current += 1;
    setStorageUserId(null);

    if (user) {
      applyAppData(getUserStoredAppData(user.uid));
      setCurrentUser(user);
      setStorageUserId(user.uid);
      setIsFirestoreReady(true);
      setShowAuthModal(false);
    } else {
      applyAppData(getDefaultAppData());
      setCurrentUser(null);
      setIsFirestoreReady(false);
      setShowAuthModal(true);
    }
  });

  return unsubscribe;
}, []);

  useEffect(() => {
    if (!currentUser) return;

    const generation = ++cloudSyncGeneration.current;

    const loadPersonalDb = async () => {
      try {
        const [settingsSnap, nutritionSnap, exerciseSnap, dietSnap, weightSnap, exerciseLogSnap] = await Promise.all([
          getDoc(doc(db, 'users', currentUser.uid, 'settings', USER_SETTINGS_DOC_ID)),
          getDocs(collection(db, 'users', currentUser.uid, 'nutritionDB')),
          getDocs(collection(db, 'users', currentUser.uid, 'exerciseDB')),
          getDocs(collection(db, 'users', currentUser.uid, 'dietLogs')),
          getDocs(collection(db, 'users', currentUser.uid, 'weightLogs')),
          getDocs(collection(db, 'users', currentUser.uid, 'exerciseLogs')),
        ]);

        if (generation !== cloudSyncGeneration.current) return;

        if (settingsSnap.exists()) {
          const settings = settingsSnap.data();
          if (settings.baseWeight !== undefined) setBaseWeight(settings.baseWeight);
          if (settings.dailyGoals) setDailyGoals(settings.dailyGoals);
          if (settings.dDayConfig) setDDayConfig(normalizeDDayConfig(settings.dDayConfig));
          if (settings.weeklyExercisePlan) setWeeklyExercisePlan(settings.weeklyExercisePlan);
        }

        const mapCloudLogs = (snap) =>
          snap.docs.map((itemDoc) => ({
            ...itemDoc.data(),
            id: itemDoc.data().id ?? itemDoc.id,
          }));

        const cloudNutrition = {};
        nutritionSnap.forEach((itemDoc) => {
          const data = itemDoc.data();
          cloudNutrition[data.name] = {
            kcal: data.kcal,
            carb: data.carb,
            protein: data.protein,
            fat: data.fat,
            sugar: data.sugar,
          };
        });

        const cloudExercise = {};
        exerciseSnap.forEach((itemDoc) => {
          const data = itemDoc.data();
          cloudExercise[data.name] = {
            part: data.part,
            type: data.type,
            time: data.time,
          };
        });

        setNutritionDB(cloudNutrition);
        setExerciseDB(cloudExercise);

        const cloudDietLogs = mapCloudLogs(dietSnap);
        const cloudWeightLogs = mapCloudLogs(weightSnap);
        const cloudExerciseLogs = mapCloudLogs(exerciseLogSnap);

        const sortedDietLogs = cloudDietLogs.sort((a, b) => a.date.localeCompare(b.date));
        setDietLogs(sortedDietLogs);
        if (sortedDietLogs.length > 0) {
          const latestDate = sortedDietLogs[sortedDietLogs.length - 1].date;
          setSelectedDietDate(latestDate);
          const [y, m] = latestDate.split('-').map(Number);
          if (y && m) setCurrentMonth(new Date(y, m - 1, 1));
        }
        setWeightLogs(cloudWeightLogs.sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time))));
        setExerciseLogs(cloudExerciseLogs.sort((a, b) => a.date.localeCompare(b.date)));
      } catch (error) {
        console.error('Load personal Firestore DB failed:', error);
        showAlert('Firestore 개인 DB를 불러오지 못했습니다. 네트워크와 보안 규칙을 확인해주세요.');
      }
    };

    loadPersonalDb();
  }, [currentUser]);

  useEffect(() => {
    setSharedSearchTerm('');
    setSharedResults([]);
  }, [dbMode]);

  useEffect(() => {
    setMonthPicker((prev) => ({ ...prev, isOpen: false, tab: null }));
  }, [activeTab]);

  const [formData, setFormData] = useState({
    meal: '아침', menu: '', qty: 1, weight: '', time: '08:00', restroom: false, memo: '', exerciseName: '', exTime: '',
    ddayStartDate: todayStr, ddayGoalDate: '',
    goalKcal: '', goalCarb: '', goalProtein: '', goalFat: '', goalSugar: ''
  });
  const [recipeForm, setRecipeForm] = useState({ name: '', ingredients: [] });
  const [newIngredient, setNewIngredient] = useState({ menu: Object.keys(nutritionDB)[0] || '', qty: 1 });
  const [singleItemForm, setSingleItemForm] = useState({ name: '', kcal: '', carb: '', protein: '', fat: '', sugar: '' });
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
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

    const info = nutritionDB[log.menu] || {};

    return {
      kcal: acc.kcal + (getNutritionValue(info.kcal) * log.qty),
      carb: acc.carb + (getNutritionValue(info.carb) * log.qty),
      protein: acc.protein + (getNutritionValue(info.protein) * log.qty),
      fat: acc.fat + (getNutritionValue(info.fat) * log.qty),
      sugar: acc.sugar + (getNutritionValue(info.sugar) * log.qty),
    };

  }, {
    kcal: 0,
    carb: 0,
    protein: 0,
    fat: 0,
    sugar: 0
  });
};



  const todayMacros = calculateMacros(getDayLogs(dietLogs, todayStr));
  const amWeights = weightLogs.filter(w => parseInt(w.time.split(':')[0], 10) >= 6 && parseInt(w.time.split(':')[0], 10) < 15);
  const baseWeightNum = Number(baseWeight) || 0;
  const latestWeight = amWeights.length > 0 ? amWeights[amWeights.length - 1]?.weight : baseWeightNum;
  const prevWeight = amWeights.length > 1 ? amWeights[amWeights.length - 2]?.weight : baseWeightNum;
  const weightDiff = (latestWeight - prevWeight).toFixed(2);
  
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayBaseDate = new Date(todayStr); 
  const last8Weeks = [];
  for(let i=7; i>=0; i--) {
      let count = 0;
      weightLogs.forEach(w => {
          if(!w.restroom) return;
          const d = new Date(w.date);
          const diffDays = Math.round((todayBaseDate - d) / msPerDay);
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

    if (type === 'dday-start' || type === 'dday-goal') {
      setFormData(prev => ({ 
        ...prev, 
        ddayStartDate: dDayConfig.startDate || todayStr, 
        ddayGoalDate: dDayConfig.goalDate || '' 
      }));
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

  const commitFirestoreBatches = async (writes) => {
    for (let i = 0; i < writes.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      writes.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach(({ ref, data, options }) => {
        batch.set(ref, data, options);
      });
      await batch.commit();
    }
  };

  const backupAllDataToFirebase = async () => {
    if (!currentUser) {
      showAlert("로그인이 필요합니다.");
      return;
    }

    setIsCloudSyncing(true);
    try {
      const writes = [];
      const uid = currentUser.uid;

      writes.push({
        ref: doc(db, 'users', uid, 'settings', USER_SETTINGS_DOC_ID),
        data: stripUndefined({
          baseWeight,
          dailyGoals,
          dDayConfig,
          weeklyExercisePlan,
          ownerId: uid,
          lastBackupAt: serverTimestamp(),
        }),
        options: { merge: true },
      });

      Object.entries(nutritionDB).forEach(([name, info]) => {
        const docId = makeDbDocId(name);
        writes.push({
          ref: doc(db, 'users', uid, 'nutritionDB', docId),
          data: stripUndefined({
            ...normalizeNutritionInfo(info),
            name,
            source: info?.source || 'single',
            ownerId: uid,
            isPublic: info?.isPublic ?? publishToSharedDb,
            searchName: normalizeSearchTerm(name),
            updatedAt: serverTimestamp(),
          }),
          options: { merge: true },
        });
      });

      Object.entries(exerciseDB).forEach(([name, info]) => {
        const docId = makeDbDocId(name);
        writes.push({
          ref: doc(db, 'users', uid, 'exerciseDB', docId),
          data: stripUndefined({
            ...info,
            name,
            ownerId: uid,
            isPublic: info?.isPublic ?? publishToSharedDb,
            searchName: normalizeSearchTerm(name),
            updatedAt: serverTimestamp(),
          }),
          options: { merge: true },
        });
      });

      dietLogs.forEach((log) => {
        writes.push({
          ref: doc(db, 'users', uid, 'dietLogs', String(log.id)),
          data: stripUndefined({ ...log, updatedAt: serverTimestamp() }),
          options: { merge: true },
        });
      });
      weightLogs.forEach((log) => {
        writes.push({
          ref: doc(db, 'users', uid, 'weightLogs', String(log.id)),
          data: stripUndefined({ ...log, updatedAt: serverTimestamp() }),
          options: { merge: true },
        });
      });
      exerciseLogs.forEach((log) => {
        writes.push({
          ref: doc(db, 'users', uid, 'exerciseLogs', String(log.id)),
          data: stripUndefined({ ...log, updatedAt: serverTimestamp() }),
          options: { merge: true },
        });
      });

      await commitFirestoreBatches(writes);
      const time = new Date().toLocaleString();
      localStorage.setItem("lastBackupTime", time);
      setLastBackupTime(time);
      showAlert("클라우드 백업이 완료되었습니다.");
    } catch (error) {
      console.error(error);
      const detail = error?.message ? `\n${error.message}` : '';
      showAlert(`백업 실패${detail}`);
    } finally {
      setIsCloudSyncing(false);
    }
  };
  // 기록 저장 처리
  const submitLog = async (e) => {
    e.preventDefault();
    
    if (modalType === 'dday-start') {
      setDDayConfig({ ...dDayConfig, startDate: formData.ddayStartDate });
      setIsModalOpen(false);
      return;
    }

    if (modalType === 'dday-goal') {
      setDDayConfig({ ...dDayConfig, goalDate: formData.ddayGoalDate });
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
      try {
        await saveUserLog('diet', data);
      } catch (error) {
        console.error('Save diet log to Firestore failed:', error);
        showAlert('로컬에는 저장했지만 Firestore 식단 기록 저장에 실패했습니다.');
      }
      
    } else if (modalType === 'weight') {
      const data = { ...baseLog, weight: Number(formData.weight), time: formData.time, restroom: formData.restroom, memo: formData.memo };
      const newArray = editingLogId ? weightLogs.map(l => l.id === editingLogId ? data : l) : [...weightLogs, data];
      setWeightLogs(newArray.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
      try {
        await saveUserLog('weight', data);
      } catch (error) {
        console.error('Save weight log to Firestore failed:', error);
        showAlert('로컬에는 저장했지만 Firestore 체중 기록 저장에 실패했습니다.');
      }
      
    } else if (modalType === 'exercise') {
      const ex = exerciseDB[formData.exerciseName];
      const data = {
        ...baseLog,
        name: formData.exerciseName,
        time: parseNumericValue(formData.exTime),
        part: ex?.part || '전신',
        type: ex?.type || '유산소',
      };
      if (editingLogId) setExerciseLogs(exerciseLogs.map(l => l.id === editingLogId ? data : l));
      else setExerciseLogs([...exerciseLogs, data]);
      try {
        await saveUserLog('exercise', data);
      } catch (error) {
        console.error('Save exercise log to Firestore failed:', error);
        showAlert('로컬에는 저장했지만 Firestore 운동 기록 저장에 실패했습니다.');
      }
    }
    setIsModalOpen(false);
  };

  // 기록 삭제 처리 (커스텀 컨펌 사용)
  const deleteLog = () => {
    showConfirm("정말 이 기록을 삭제하시겠습니까?", () => {
      if (modalType === 'diet') setDietLogs(dietLogs.filter(l => l.id !== editingLogId));
      else if (modalType === 'weight') setWeightLogs(weightLogs.filter(l => l.id !== editingLogId));
      else if (modalType === 'exercise') setExerciseLogs(exerciseLogs.filter(l => l.id !== editingLogId));
      deleteUserLog(modalType, editingLogId).catch((error) => {
        console.error('Delete Firestore log failed:', error);
        showAlert('로컬에서는 삭제했지만 Firestore 기록 삭제에 실패했습니다.');
      });
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
      setSingleItemForm({
        name: key,
        kcal: formatNutritionFieldForInput(info.kcal),
        carb: formatNutritionFieldForInput(info.carb),
        protein: formatNutritionFieldForInput(info.protein),
        fat: formatNutritionFieldForInput(info.fat),
        sugar: formatNutritionFieldForInput(info.sugar),
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelDbEdit = () => {
    setDbEditingKey(null);
    setSingleItemForm({ name: '', kcal: '', carb: '', protein: '', fat: '', sugar: '' });
    setPublishToSharedDb(true);
    setNewExerciseForm({ name: '', part: '전신', type: '유산소', time: '' });
  };

  const handleDeleteDbItem = () => {
    showConfirm("정말 이 데이터를 삭제하시겠습니까?\n(기존 기록들의 정보가 부정확해질 수 있습니다)", async () => {
      if (dbMode === 'exercise') {
        const newDB = {...exerciseDB};
        delete newDB[dbEditingKey];
        setExerciseDB(newDB);
      } else {
        const newDB = {...nutritionDB};
        delete newDB[dbEditingKey];
        setNutritionDB(newDB);
      }
      try {
        await deletePersonalDbItem(dbMode === 'exercise' ? 'exercise' : 'nutrition', dbEditingKey);
      } catch (error) {
        console.error('Delete Firestore DB item failed:', error);
        showAlert('로컬 DB에서는 삭제했지만 Firestore 삭제에 실패했습니다.');
      }
      cancelDbEdit();
      closeDialog();
    });
  };

  const savePersonalNutritionItem = async (name, info, source = 'single', publish = true) => {
    if (!currentUser) return;

    const docId = makeDbDocId(name);
    const payload = {
      ...info,
      name,
      source,
      ownerId: currentUser.uid,
      isPublic: publish,
      searchName: normalizeSearchTerm(name),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', currentUser.uid, 'nutritionDB', docId), payload, { merge: true });

    if (publish) {
      await setDoc(doc(db, 'publicNutritionDB', `${currentUser.uid}_${docId}`), payload, { merge: true });
    } else {
      await deleteDoc(doc(db, 'publicNutritionDB', `${currentUser.uid}_${docId}`)).catch((error) => {
        console.warn('Skip public nutrition delete:', error);
      });
    }
  };

  const savePersonalExerciseItem = async (name, info, publish = true) => {
    if (!currentUser) return;

    const docId = makeDbDocId(name);
    const payload = {
      ...info,
      name,
      ownerId: currentUser.uid,
      isPublic: publish,
      searchName: normalizeSearchTerm(name),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', currentUser.uid, 'exerciseDB', docId), payload, { merge: true });

    if (publish) {
      await setDoc(doc(db, 'publicExerciseDB', `${currentUser.uid}_${docId}`), payload, { merge: true });
    } else {
      await deleteDoc(doc(db, 'publicExerciseDB', `${currentUser.uid}_${docId}`)).catch((error) => {
        console.warn('Skip public exercise delete:', error);
      });
    }
  };

  const deletePersonalDbItem = async (type, name) => {
    if (!currentUser || !name) return;

    const docId = makeDbDocId(name);
    const privatePath = type === 'exercise' ? 'exerciseDB' : 'nutritionDB';
    const publicPath = type === 'exercise' ? 'publicExerciseDB' : 'publicNutritionDB';

    await Promise.all([
      deleteDoc(doc(db, 'users', currentUser.uid, privatePath, docId)),
      deleteDoc(doc(db, publicPath, `${currentUser.uid}_${docId}`)),
    ]);
  };

  const getLogCollectionName = (type) => {
    if (type === 'diet') return 'dietLogs';
    if (type === 'weight') return 'weightLogs';
    return 'exerciseLogs';
  };

  const saveUserLog = async (type, data) => {
    if (!currentUser || !data?.id) return;

    await setDoc(
      doc(db, 'users', currentUser.uid, getLogCollectionName(type), String(data.id)),
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const deleteUserLog = async (type, id) => {
    if (!currentUser || !id) return;

    await deleteDoc(doc(db, 'users', currentUser.uid, getLogCollectionName(type), String(id)));
  };

  const searchSharedDb = async () => {
    if (!isFirestoreReady) {
      showAlert('Firestore 연결을 준비 중입니다. 잠시 후 다시 검색해주세요.');
      return;
    }

    setIsSharedLoading(true);
    const isExerciseSearch = dbMode === 'exercise';
    const collectionName = isExerciseSearch ? 'publicExerciseDB' : 'publicNutritionDB';
    const searchTerm = normalizeSearchTerm(sharedSearchTerm);

    try {
      const sharedQuery = searchTerm
        ? query(
            collection(db, collectionName),
            orderBy('searchName'),
            where('searchName', '>=', searchTerm),
            where('searchName', '<=', `${searchTerm}\uf8ff`),
            limit(25)
          )
        : query(collection(db, collectionName), orderBy('updatedAt', 'desc'), limit(25));

      const snapshot = await getDocs(sharedQuery);
      setSharedResults(snapshot.docs.map((itemDoc) => ({
        id: itemDoc.id,
        ...itemDoc.data(),
        dbKind: isExerciseSearch ? 'exercise' : 'nutrition',
      })));
    } catch (error) {
      console.error('Search shared Firestore DB failed:', error);
      showAlert('공유 DB 검색에 실패했습니다. Firestore 인덱스와 보안 규칙을 확인해주세요.');
    } finally {
      setIsSharedLoading(false);
    }
  };

  const importSharedItem = async (item) => {
    try {
      if (item.dbKind === 'exercise') {
        const exerciseInfo = { part: item.part, type: item.type, time: Number(item.time) || 0 };
        setExerciseDB((prev) => ({ ...prev, [item.name]: exerciseInfo }));
        await savePersonalExerciseItem(item.name, exerciseInfo, false);
      } else {
        const nutritionInfo = {
          kcal: normalizeRangeInput(item.kcal),
          carb: normalizeRangeInput(item.carb),
          protein: normalizeRangeInput(item.protein),
          fat: normalizeRangeInput(item.fat),
          sugar: normalizeRangeInput(item.sugar),
        };
        setNutritionDB((prev) => ({ ...prev, [item.name]: nutritionInfo }));
        await savePersonalNutritionItem(item.name, nutritionInfo, item.source || 'single', false);
      }
      showAlert('공유 DB에서 가져오기 완료!');
    } catch (error) {
      console.error('Import shared item failed:', error);
      showAlert('가져오기에 실패했습니다.');
    }
  };

  const escapeCsvCell = (cell) => {
    return `"${String(cell ?? "")
      .replace(/"/g, '""')
      .replace(/\n/g, " ")
      .replace(/\r/g, " ")}"`;
  };

  const downloadAllCsv = () => {
    const exportDateStr = getLocalDateString(new Date());

    const dietRows = [
      ["날짜", "식사", "메뉴", "수량", "칼로리", "탄수화물", "단백질", "지방", "첨가당"]
    ];

    dietLogs.forEach(log => {
      const info = nutritionDB[log.menu] || {};
      dietRows.push([
        log.date || "",
        log.meal || "",
        log.menu || "",
        log.qty || 1,
        info.kcal || 0,
        info.carb || 0,
        info.protein || 0,
        info.fat || 0,
        info.sugar || 0
      ]);
    });

    const dietCsv = "\uFEFF" + dietRows
      .map(row => row.map(cell => escapeCsvCell(cell)).join(";"))
      .join("\n");

    const dietLink = document.createElement("a");
    dietLink.href = URL.createObjectURL(new Blob([dietCsv], { type: "text/csv;charset=utf-8;" }));
    dietLink.download = `diet_logs_${exportDateStr}.csv`;
    dietLink.click();
    URL.revokeObjectURL(dietLink.href);

    const weightRows = [["날짜", "시간", "체중", "화장실 여부", "메모"]];
    weightLogs.forEach(log => {
      weightRows.push([
        log.date || "",
        log.time || "",
        log.weight || "",
        log.restroom ? "O" : "X",
        log.memo || ""
      ]);
    });

    const weightCsv = "\uFEFF" + weightRows
      .map(row => row.map(cell => escapeCsvCell(cell)).join(";"))
      .join("\n");

    const weightLink = document.createElement("a");
    weightLink.href = URL.createObjectURL(new Blob([weightCsv], { type: "text/csv;charset=utf-8;" }));
    weightLink.download = `weight_logs_${exportDateStr}.csv`;
    weightLink.click();
    URL.revokeObjectURL(weightLink.href);

    const exerciseRows = [["날짜", "운동명", "운동 부위", "운동 종류", "운동 시간"]];
    exerciseLogs.forEach(log => {
      exerciseRows.push([
        log.date || "",
        log.name || "",
        log.part || "",
        log.type || "",
        log.time || ""
      ]);
    });

    const exerciseCsv = "\uFEFF" + exerciseRows
      .map(row => row.map(cell => escapeCsvCell(cell)).join(";"))
      .join("\n");

    const exerciseLink = document.createElement("a");
    exerciseLink.href = URL.createObjectURL(new Blob([exerciseCsv], { type: "text/csv;charset=utf-8;" }));
    exerciseLink.download = `exercise_logs_${exportDateStr}.csv`;
    exerciseLink.click();
    URL.revokeObjectURL(exerciseLink.href);

    showAlert("CSV 다운로드 완료!");
  };

  const normalizeDate = (value) => {
    let str = String(value ?? "")
      .replace(/\uFEFF/g, "")
      .trim();

    if (!str) return "";

    // (금), (토) 등 요일 괄호 제거
    str = str.replace(/\([^)]*\)/g, "").trim();
    str = str.split(/[T ]/)[0];

    const numericOnly = str.replace(/,/g, "");
    if (/^\d+(\.\d+)?$/.test(numericOnly)) {
      const serial = Number(numericOnly);
      if (serial > 30000 && serial < 100000) {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        return getLocalDateString(new Date(excelEpoch.getTime() + serial * 86400000));
      }
    }

    // 2026/5/1, 2026.5.1, 2026-5-1 등
    const slashMatch = str.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
    if (slashMatch) {
      const year = slashMatch[1];
      const month = String(Number(slashMatch[2])).padStart(2, "0");
      const day = String(Number(slashMatch[3])).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    str = str
      .replace(/\./g, "-")
      .replace(/\//g, "-")
      .replace(/\s/g, "");

    const match = str.match(/^(\d{4}|\d{2})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const year = match[1].length === 2 ? `20${match[1]}` : match[1];
      const month = String(Number(match[2])).padStart(2, "0");
      const day = String(Number(match[3])).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    return "";
  };

  const normalizeMeal = (meal) => {
    const normalized = sanitizeCsvCell(meal);
    const allowed = ["아침", "점심", "저녁", "간식"];
    return allowed.includes(normalized) ? normalized : "아침";
  };

  const focusCalendarOnDate = (dateStr, tab = "diet") => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    const [y, m] = dateStr.split("-").map(Number);
    if (!y || !m) return;
    if (tab === "exercise") setSelectedExerciseDate(dateStr);
    else if (tab === "weight") setSelectedWeightDate(dateStr);
    else setSelectedDietDate(dateStr);
    setCurrentMonth(new Date(y, m - 1, 1));
  };

  const reloadLogsFromFirestore = async (logType) => {
    if (!currentUser) return [];

    const snap = await getDocs(query(collection(db, 'users', currentUser.uid, getLogCollectionName(logType))));
    return snap.docs
      .map((itemDoc) => ({
        ...itemDoc.data(),
        id: itemDoc.data().id ?? itemDoc.id,
      }))
      .sort((a, b) => {
        const dateCompare = String(a.date).localeCompare(String(b.date));
        if (dateCompare !== 0) return dateCompare;
        if (logType === "weight") return String(a.time).localeCompare(String(b.time));
        return 0;
      });
  };

  const parseRangeValue = (value) => normalizeRangeInput(value);

  const parseNumericValue = (value) => {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return isNaN(value) ? 0 : value;

    const str = String(value).trim();
    if (!str) return 0;
    if (str.includes("~")) return getNutritionValue(str);

    const match = str.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };

  const formatExerciseMinutes = (time) => {
    const minutes = parseNumericValue(time);
    return minutes > 0 ? `${minutes}분` : "자유";
  };

  const getCsvField = (row, ...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== "") return row[key];
    }
    const normalizedTargets = keys.map((key) => key.replace(/\s/g, ""));
    for (const [rawKey, value] of Object.entries(row)) {
      const normalizedKey = rawKey.replace(/\s/g, "");
      if (normalizedTargets.some((target) => normalizedKey === target || normalizedKey.includes(target))) {
        if (value !== "") return value;
      }
    }
    return "";
  };

  const sanitizeCsvCell = (value) =>
    String(value ?? "")
      .replace(/\r/g, "")
      .replace(/\n/g, " ")
      .replace(/^"+|"+$/g, "")
      .trim();

  const parseCsvRows = (text) => {
    const trimmed = String(text || "").trim().replace(/^\uFEFF/, "");

    const tryParse = (delimiter) =>
      Papa.parse(trimmed, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        quoteChar: '"',
        escapeChar: '"',
      });

    const getColCount = (parsed) => Object.keys(parsed.data[0] || {}).length;

    // 탭(엑셀), 세미콜론(앱보내기), 쉼표 순으로 가장 많은 열이 나오는 구분자 선택
    const candidates = [tryParse("\t"), tryParse(";"), tryParse(",")];
    const parsed = candidates.reduce((best, cur) =>
      getColCount(cur) > getColCount(best) ? cur : best
    );

    return parsed.data;
  };

  const normalizeCsvRow = (rawRow) => {
    const row = {};
    Object.keys(rawRow).forEach((key) => {
      row[String(key).replace(/\uFEFF/g, "").trim()] = sanitizeCsvCell(rawRow[key]);
    });
    return row;
  };

  const clearFirestoreCollections = async (collectionNames) => {
    for (const colName of collectionNames) {
      const snapshot = await getDocs(query(collection(db, 'users', currentUser.uid, colName)));
      await Promise.all(snapshot.docs.map((itemDoc) => deleteDoc(itemDoc.ref)));
    }
  };

  const handleCsvImport = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!currentUser) {
      showAlert("로그인이 필요합니다.");
      return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      const importGeneration = ++cloudSyncGeneration.current;

      try {
        const rows = parseCsvRows(e.target.result);
        const newLogs = [];
        const nutritionUpdates = {};
        const exerciseUpdates = {};

        const targetCollections = [];
        if (type === "diet") {
          targetCollections.push("dietLogs", "nutritionDB");
        } else if (type === "weight") {
          targetCollections.push("weightLogs");
        } else if (type === "exercise") {
          targetCollections.push("exerciseLogs", "exerciseDB");
        }

        await clearFirestoreCollections(targetCollections);

        for (const rawRow of rows) {
          const row = normalizeCsvRow(rawRow);

          if (type === "diet") {
            const menuName = row["메뉴"];
            const logDate = normalizeDate(row["날짜"]);
            if (!menuName || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) continue;

            nutritionUpdates[menuName] = {
              kcal: parseRangeValue(row["칼로리"]),
              carb: parseRangeValue(row["탄수화물"]),
              protein: parseRangeValue(row["단백질"]),
              fat: parseRangeValue(row["지방"]),
              sugar: parseRangeValue(row["첨가당"]),
            };

            newLogs.push({
              id: String(Date.now() + Math.random()),
              date: logDate,
              meal: normalizeMeal(row["식사"]),
              menu: menuName,
              qty: Number(row["수량"]) || 1
            });
          } else if (type === "weight") {
            const logDate = normalizeDate(getCsvField(row, "날짜"));
            if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) continue;

            newLogs.push({
              id: String(Date.now() + Math.random()),
              date: logDate,
              time: getCsvField(row, "시간") || "08:00",
              weight: parseNumericValue(getCsvField(row, "체중")),
              restroom: ["O", "true", "TRUE", "o"].includes(getCsvField(row, "화장실 여부")),
              memo: getCsvField(row, "메모") || ""
            });
          } else if (type === "exercise") {
            const exName = getCsvField(row, "운동명");
            const logDate = normalizeDate(getCsvField(row, "날짜"));
            if (!exName || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) continue;

            const exInfo = {
              part: getCsvField(row, "운동 부위") || "전신",
              type: getCsvField(row, "운동 종류") || "유산소",
              time: parseNumericValue(getCsvField(row, "운동 시간")),
            };
            exerciseUpdates[exName] = exInfo;

            newLogs.push({
              id: String(Date.now() + Math.random()),
              date: logDate,
              name: exName,
              part: exInfo.part,
              type: exInfo.type,
              time: exInfo.time,
            });
          }
        }

        if (type === "diet") {
          setNutritionDB(nutritionUpdates);
          setDietLogs(newLogs);

          for (const [name, info] of Object.entries(nutritionUpdates)) {
            await savePersonalNutritionItem(name, info, 'single', publishToSharedDb);
          }
        } else if (type === "weight") {
          setWeightLogs(newLogs.sort((a, b) =>
            a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time))
          ));
        } else if (type === "exercise") {
          setExerciseDB(exerciseUpdates);
          setExerciseLogs(newLogs);

          for (const [name, info] of Object.entries(exerciseUpdates)) {
            await savePersonalExerciseItem(name, info, publishToSharedDb);
          }
        }

        for (const log of newLogs) {
          await saveUserLog(type, log);
        }

        if (importGeneration === cloudSyncGeneration.current) {
          const cloudLogs = await reloadLogsFromFirestore(type);

          if (type === "diet") {
            setDietLogs(cloudLogs.length > 0 ? cloudLogs : newLogs);
            const targetDate = (cloudLogs.length > 0 ? cloudLogs : newLogs)[0]?.date;
            focusCalendarOnDate(targetDate, "diet");
          } else if (type === "weight") {
            setWeightLogs(cloudLogs.length > 0 ? cloudLogs : newLogs);
            const targetDate = (cloudLogs.length > 0 ? cloudLogs : newLogs)[0]?.date;
            focusCalendarOnDate(targetDate, "weight");
          } else if (type === "exercise") {
            setExerciseLogs(cloudLogs.length > 0 ? cloudLogs : newLogs);
            const targetDate = (cloudLogs.length > 0 ? cloudLogs : newLogs)[0]?.date;
            focusCalendarOnDate(targetDate, "exercise");
          }
        }

        const successMessage =
          type === "diet"
            ? "식단 기록과 식단 DB가 CSV 데이터로 덮어씌워졌습니다."
            : type === "exercise"
              ? "운동 기록과 운동 DB가 CSV 데이터로 덮어씌워졌습니다."
              : "체중 기록이 CSV 데이터로 덮어씌워졌습니다.";
        showAlert(successMessage);
      } catch (error) {
        console.error(error);
        showAlert("CSV 업로드 및 데이터베이스 초기화 중 오류가 발생했습니다.");
      }
    };

    reader.readAsText(file, "utf-8");
    event.target.value = "";
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

  const openMonthPicker = (tab) => {
    setMonthPicker({
      isOpen: true,
      tab,
      year: currentMonth.getFullYear(),
      month: currentMonth.getMonth(),
    });
  };

  const closeMonthPicker = () => {
    setMonthPicker((prev) => ({ ...prev, isOpen: false, tab: null }));
  };

  const selectPickerMonth = (monthIndex) => {
    setCurrentMonth(new Date(monthPicker.year, monthIndex, 1));
    closeMonthPicker();
  };

  const goToToday = (tab) => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    if (tab === "diet") setSelectedDietDate(todayStr);
    else if (tab === "weight") setSelectedWeightDate(todayStr);
    else if (tab === "exercise") setSelectedExerciseDate(todayStr);
    closeMonthPicker();
  };

  const renderCalendarNavigator = (tab) => {
    const theme = {
      diet: {
        today: "text-yellow-800 border-yellow-200 bg-yellow-100 hover:bg-yellow-200",
        pickerBtn: "hover:bg-yellow-100 text-yellow-800",
        monthActive: "bg-yellow-100 text-yellow-800 border border-yellow-200",
        monthIdle: "bg-gray-50 text-gray-700 hover:bg-yellow-100",
        yearBtn: "hover:bg-yellow-100 text-yellow-800",
      },
      weight: {
        today: "text-teal-500 border-teal-200 bg-teal-50 hover:bg-teal-100",
        pickerBtn: "hover:bg-teal-50 text-teal-500",
        monthActive: "bg-teal-500 text-white",
        monthIdle: "bg-gray-50 text-gray-700 hover:bg-teal-50",
        yearBtn: "hover:bg-teal-50 text-teal-500",
      },
      exercise: {
        today: "text-teal-500 border-teal-200 bg-teal-50 hover:bg-teal-100",
        pickerBtn: "hover:bg-teal-50 text-teal-500",
        monthActive: "bg-teal-500 text-white",
        monthIdle: "bg-gray-50 text-gray-700 hover:bg-teal-50",
        yearBtn: "hover:bg-teal-50 text-teal-500",
      },
    }[tab];

    const isPickerOpen = monthPicker.isOpen && monthPicker.tab === tab;
    const monthLabels = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

    return (
      <div className="space-y-2 px-2">
        <div className="flex justify-between items-center">
          <button type="button" onClick={() => handleMonthChange(-1)} className="p-1 rounded-lg hover:bg-gray-100">
            <ChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => (isPickerOpen ? closeMonthPicker() : openMonthPicker(tab))}
            className={`font-bold text-lg px-3 py-1 rounded-lg transition-colors ${theme.pickerBtn}`}
          >
            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
          </button>
          <button type="button" onClick={() => handleMonthChange(1)} className="p-1 rounded-lg hover:bg-gray-100">
            <ChevronRight />
          </button>
        </div>

        {isPickerOpen && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm animate-fade-in">
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => setMonthPicker((prev) => ({ ...prev, year: prev.year - 1 }))}
                className={`p-2 rounded-lg font-bold ${theme.yearBtn}`}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-base min-w-[80px] text-center">{monthPicker.year}년</span>
              <button
                type="button"
                onClick={() => setMonthPicker((prev) => ({ ...prev, year: prev.year + 1 }))}
                className={`p-2 rounded-lg font-bold ${theme.yearBtn}`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {monthLabels.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => selectPickerMonth(idx)}
                  className={`py-2 text-sm font-bold rounded-lg transition-colors ${
                    monthPicker.month === idx ? theme.monthActive : theme.monthIdle
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => goToToday(tab)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${theme.today}`}
          >
            오늘
          </button>
        </div>
      </div>
    );
  };

  // --- 시작일 및 목표일 계산 로직 ---
  const getDdayInfos = () => {
    const today = new Date(todayStr).getTime();
    
    // 시작일 계산
    let startInfo = { text: "D-Day", subText: "다이어트 시작한지" };
    if (dDayConfig.startDate) {
      const startTarget = new Date(dDayConfig.startDate).getTime();
      const diffDays = Math.ceil((startTarget - today) / (1000 * 60 * 60 * 24));
      const passed = -diffDays;
      if (passed < 0) startInfo = { text: `D${passed}`, subText: "다이어트 시작 전" };
      else if (passed === 0) startInfo = { text: "D-Day", subText: "다이어트 시작한지" };
      else startInfo = { text: `D+${passed}`, subText: "다이어트 시작한지" };
    }

    // 목표일 계산
    let goalInfo = { text: "미설정", subText: "클릭하여 목표일 추가" };
    if (dDayConfig.goalDate) {
      const goalTarget = new Date(dDayConfig.goalDate).getTime();
      const diffDays = Math.ceil((goalTarget - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) goalInfo = { text: `D+${-diffDays}`, subText: "목표일 지남" };
      else if (diffDays === 0) goalInfo = { text: "D-Day", subText: "다이어트 목표까지" };
      else goalInfo = { text: `D-${diffDays}`, subText: "다이어트 목표까지" };
    }

    return { startInfo, goalInfo };
  };

  // ============================
  // 헤더 렌더링 함수
  // ============================
  const renderHeader = () => {
    let title = '';
    let Icon = null;
    let buttonConfig = null;

    if (activeTab === 'home') {
      title = '오늘의 요약';
      Icon = Home;
    } else if (activeTab === 'database') {
      title = '종합 DB';
      Icon = Database;
    } else if (activeTab === 'diet') {
      title = '식단 관리';
      Icon = Utensils;
      buttonConfig = { label: '식단 기록', type: 'diet', date: selectedDietDate };
    } else if (activeTab === 'weight') {
      title = '체중 관리';
      Icon = Scale;
      buttonConfig = { label: '체중 기록', type: 'weight', date: selectedWeightDate };
    } else if (activeTab === 'exercise') {
      title = '운동 관리';
      Icon = Dumbbell;
      buttonConfig = { label: '운동 기록', type: 'exercise', date: selectedExerciseDate };
    } else if (activeTab === 'account') {
  title = '계정';
  Icon = Settings;
}

    return (
      <header className="bg-white/90 backdrop-blur-md pt-10 pb-4 px-6 sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex justify-between items-center">
        <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2.5">
          {Icon && <Icon className="text-gray-700" size={26} strokeWidth={2.5} />}
          {title}
        </h1>
        {buttonConfig && (
          <button 
            onClick={() => openModal(buttonConfig.type, null, buttonConfig.date)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm ${
              buttonConfig.type === 'diet'
                ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-200'
                : 'bg-teal-500 hover:bg-teal-600 text-white'
            }`}
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
    const { startInfo, goalInfo } = getDdayInfos();

    return (
      <div className="space-y-4 pb-20 animate-fade-in flex flex-col items-center">

        {/* 시작일 & 목표일 위젯 (가로 배치) */}
        <div className="grid grid-cols-2 gap-4 w-full mb-1">
          <div onClick={() => openModal('dday-start')} className="h-32 bg-white rounded-2xl shadow-sm border border-[#60a5fa]/35 p-4 flex flex-col justify-center items-center relative cursor-pointer hover:bg-[#60a5fa]/10 transition-colors group">
            <div className="absolute top-3 left-3 text-[10px] font-bold text-[#60a5fa] bg-[#60a5fa]/10 px-2 py-0.5 rounded" style={{ color: DDAY_BLUE }}>시작일</div>
            <span className="text-3xl font-black tracking-tight mb-2 text-[#60a5fa] mt-3" style={{ color: DDAY_BLUE }}>{startInfo.text}</span>
            <span className="text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full group-hover:bg-[#60a5fa]/15 transition-colors">{startInfo.subText}</span>
            <Calendar size={14} className="absolute top-3 right-3 text-gray-300 group-hover:text-[#60a5fa] transition-colors" />
          </div>
          
          <div onClick={() => openModal('dday-goal')} className="h-32 bg-white rounded-2xl shadow-sm border border-[#f87171]/35 p-4 flex flex-col justify-center items-center relative cursor-pointer hover:bg-[#f87171]/10 transition-colors group">
            <div className="absolute top-3 left-3 text-[10px] font-bold text-[#f87171] bg-[#f87171]/10 px-2 py-0.5 rounded" style={{ color: RESTROOM_RED }}>목표일</div>
            <span className="text-3xl font-black tracking-tight mb-2 text-[#f87171] mt-3" style={{ color: RESTROOM_RED }}>{goalInfo.text}</span>
            <span className="text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full group-hover:bg-[#f87171]/15 transition-colors">{goalInfo.subText}</span>
            <Calendar size={14} className="absolute top-3 right-3 text-gray-300 group-hover:text-[#f87171] transition-colors" />
          </div>
        </div>

        {/* 오늘의 체중 (그 아래 가로로 꽉 차게 변경) */}
        <div className="h-28 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col justify-center items-center relative w-full mb-2">
          <span className="text-[11px] font-bold text-gray-400 mb-1">오늘의 체중</span>
          <div className="text-3xl font-extrabold text-gray-800 flex items-end tracking-tighter mb-2">
            {latestWeight} <span className="text-sm font-medium text-gray-400 ml-1 mb-1 tracking-normal">kg</span>
          </div>
          <div className="text-[10px] font-bold flex items-center justify-center bg-gray-50 px-3 py-1 rounded-full text-gray-500 border border-gray-100">
            전날대비: {Number(weightDiff) > 0 ? <span className="text-red-500 flex items-center ml-1"><ArrowUp size={10}/> {weightDiff}</span> 
                      : Number(weightDiff) < 0 ? <span className="text-teal-500 flex items-center ml-1"><ArrowDown size={10}/> {Math.abs(weightDiff)}</span> : <span className="ml-1">-</span>}
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
            { label: '탄수화물', cur: todayMacros.carb, max: dailyGoals.carb, unit: 'g', color: 'bg-teal-400' },
            { label: '단백질', cur: todayMacros.protein, max: dailyGoals.protein, unit: 'g', color: 'bg-teal-400' },
            { label: '지방', cur: todayMacros.fat, max: dailyGoals.fat, unit: 'g', color: 'bg-yellow-400' },
            { label: '첨가당', cur: todayMacros.sugar, max: dailyGoals.sugar, unit: 'g', color: 'bg-purple-400' }
          ].map(n => {
            const max = getNutritionValue(n.max);
            const pct = max > 0 ? Math.min((getNutritionValue(n.cur) / max) * 100, 100) : 0;
            return (
              <div key={n.label} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-700">{n.label}</span>
                  <span className="text-gray-500">{getNutritionValue(n.cur).toFixed(1)} / {n.max}{n.unit} ({pct.toFixed(0)}%)</span>
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
              <Calendar size={16} className="mr-1.5 text-teal-500" />
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
                       <span className="ml-2 text-[9px] bg-teal-100 text-teal-500 px-1.5 py-0.5 rounded font-medium">{exInfo.part}</span>
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
        {renderCalendarNavigator("diet")}

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
                    ${isSelected ? 'border-yellow-200 bg-yellow-100 font-bold text-yellow-800' : 'border-transparent hover:bg-yellow-50'}`}
                >
                  <span className="text-[12px]">{parseInt(dateStr.slice(-2), 10)}</span>
                  {hasLog && <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full absolute bottom-1"></div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-yellow-100 px-4 py-3 border-b border-yellow-200 flex justify-between items-center">
            <h2 className="font-bold text-yellow-800 flex items-center"><Utensils size={18} className="mr-2"/>{selectedDietDate.slice(5)} 식단 기록</h2>
          </div>
          <div className="p-4 space-y-5">
            {logsByMeal.map(({meal, logs, macros}) => (
              <div key={meal} className={logs.length === 0 ? "opacity-50" : ""}>
                <div className="flex justify-between items-end border-b pb-1 mb-2">
                  <h3 className="text-sm font-extrabold text-gray-700">{meal}</h3>
                  <span className="text-[10px] text-gray-500">
                    C:{macros.carb.toFixed(1)} P:{macros.protein.toFixed(1)} F:{macros.fat.toFixed(1)} S:{macros.sugar.toFixed(1)} <strong className="text-yellow-800 ml-1">{macros.kcal.toFixed(0)}kcal</strong>
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
                          <span className="text-gray-500">{info ? Math.round(getNutritionValue(info.kcal) * log.qty) : 0} kcal</span>
                        </li>
                      )
                    })}
                  </ul>
                ) : <p className="text-[10px] text-gray-400">기록 없음</p>}
              </div>
            ))}
            <div className="mt-4 pt-4 border-t-2 border-gray-200">
              <h3 className="font-bold text-gray-800 mb-2 text-sm text-center">일일 합계 및 잔여량</h3>
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
                    <td className="p-2">{selectedMacros.kcal.toFixed(0)}</td>
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
                      const remainder = getNutritionValue(item.max) - getNutritionValue(item.cur);
                      return (
                        <td key={i} className={`p-2 font-bold ${remainder >= 0 ? 'text-yellow-800' : 'text-red-500'}`}>
                          {formatRemainder(item.max, item.cur)}
                        </td>
                      );
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
    
    const baseWeightNum = Number(baseWeight) || 0;
    const diffStart = currentW && baseWeightNum > 0 ? (currentW - baseWeightNum).toFixed(2) : null;

    const last30DaysWeights = amWeights.filter(w => new Date(w.date) >= new Date(Date.now() - 30 * 86400000)).sort((a,b) => a.date.localeCompare(b.date));
    let minW = baseWeightNum || 50, maxW = baseWeightNum || 50, points = "", minPoint = null, maxPoint = null, minIdx = 0, maxIdx = 0;
    
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
      if(Number(val) < 0) return <span className="text-teal-500 font-bold">{val}</span>;
      return <span className="text-gray-500 font-bold">{val}</span>;
    }

    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        {/* 기준 날짜 입력란 제거됨 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-sm text-gray-700">시작 기준 몸무게</h2>
          <div className="flex items-center w-32">
            <input type="number" value={baseWeight} className="bg-gray-50 border-none p-2 rounded-xl w-full text-base font-bold text-right" 
                    onChange={(e) => { 
                      const val = parseFloat(e.target.value); 
                      const validVal = isNaN(val) ? 0 : val;
                      setBaseWeight(validVal); 
                    }} />
            <span className="text-sm text-gray-500 ml-2 font-medium">kg</span>
          </div>
        </div>

        {renderCalendarNavigator("weight")}

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
                    ${isSelected ? 'border-teal-500 bg-teal-50 shadow-inner' : 'border-gray-100 hover:bg-gray-100'}`}
                >
                  <span className={`text-[10px] mb-0.5 ${isSelected ? 'text-teal-500 font-bold' : 'text-gray-500'}`}>{parseInt(dateStr.slice(-2), 10)}</span>
                  {hasRestroom && <Check size={12} strokeWidth={4} className="absolute top-1 right-1 text-red-500" />}
                  {amLog && <div className="bg-yellow-100 text-yellow-800 text-[9px] font-bold px-1 py-0.5 rounded-md w-full text-center truncate shadow-sm mb-0.5">{amLog}</div>}
                  {pmLog && <div className="bg-teal-100 text-teal-500 text-[9px] font-bold px-1 py-0.5 rounded-md w-full text-center truncate shadow-sm">{pmLog}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-teal-50 px-4 py-3 border-b border-teal-100 flex justify-between items-center">
            <h2 className="font-bold text-teal-500 flex items-center"><Scale size={18} className="mr-2"/>{selectedWeightDate.slice(5)} 체중 분석</h2>
            <span className="text-sm font-extrabold text-teal-500">{currentW ? `${currentW} kg` : '기록 없음'}</span>
          </div>
          <div className="p-4">
            <table className="w-full text-center text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="pb-2 font-medium w-1/3 border-r">전날 오후 대비</th>
                  <th className="pb-2 font-medium w-1/3 border-r">전날 대비</th>
                  {/* 동적으로 변경되는 시작일 표시 (메인탭 설정 값) */}
                  <th className="pb-2 font-medium w-1/3">시작일({dDayConfig.startDate ? dDayConfig.startDate.slice(5) : '미정'}) 대비</th>
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
                       <span className="font-bold text-teal-500">
                         {parseNumericValue(log.weight) > 0 ? `${parseNumericValue(log.weight)} kg` : '—'}
                       </span>
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
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">최근 1달 체중 변화</h3>
          <div className="relative w-full h-36 border-b border-l border-gray-200">
            {last30DaysWeights.length > 1 ? (
               <svg className="w-full h-full overflow-visible" viewBox="0 0 300 120" preserveAspectRatio="none">
                 <polyline fill="none" stroke={WEIGHT_CHART_LINE} strokeWidth="2.5" strokeLinejoin="round" points={points} className="drop-shadow-sm"/>
                 {maxPoint && (
                   <g transform={`translate(${(maxIdx / (last30DaysWeights.length - 1)) * 300}, ${120 - 20 - ((maxPoint.weight - minW) / (maxW - minW)) * 80 - 14})`}>
                     <rect x="-28" y="-8" width="56" height="16" rx="4" fill="#fef2f2" stroke="#fecaca" strokeWidth="1" />
                     <text y="3" textAnchor="middle" fontSize="8.5" fill="#ef4444" fontWeight="bold">최고 {maxPoint.weight}</text>
                   </g>
                 )}
                 {minPoint && (
                   <g transform={`translate(${(minIdx / (last30DaysWeights.length - 1)) * 300}, ${120 - 20 - ((minPoint.weight - minW) / (maxW - minW)) * 80 + 14})`}>
                     <rect x="-28" y="-8" width="56" height="16" rx="4" fill="#f0fdfa" stroke="#99f6e4" strokeWidth="1" />
                     <text y="3" textAnchor="middle" fontSize="8.5" fill={CHART_MINT} fontWeight="bold">최저 {minPoint.weight}</text>
                   </g>
                 )}
               </svg>
            ) : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">데이터가 부족합니다.</div>}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">최근 8주 화장실 횟수</h3>
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
  const days = generateCalendarDays(
    currentMonth.getFullYear(),
    currentMonth.getMonth()
  );

  const selectedLogs = getDayLogs(exerciseLogs, selectedExerciseDate);

  const recent7Days = Array.from({ length: 7 }, (_, i) =>
    getLocalDateString(new Date(Date.now() - i * 86400000))
  ).reverse();

  const partStats = { 상체: 0, 하체: 0, 전신: 0 };
  let totalExTime = 0;
  recent7Days.forEach((date) => {
    getDayLogs(exerciseLogs, date).forEach((log) => {
      const minutes = parseNumericValue(log.time);
      const part = partStats[log.part] !== undefined ? log.part : "전신";
      partStats[part] += minutes;
      totalExTime += minutes;
    });
  });

  const upperPct = totalExTime > 0 ? (partStats["상체"] / totalExTime) * 100 : 0;
  const lowerPct = totalExTime > 0 ? (partStats["하체"] / totalExTime) * 100 : 0;
  const partChartColors = { 상체: "#60a5fa", 하체: "#facc15", 전신: "#f87171" };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {renderCalendarNavigator("exercise")}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400 mb-2">
          <div>일</div>
          <div>월</div>
          <div>화</div>
          <div>수</div>
          <div>목</div>
          <div>금</div>
          <div>토</div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((dateStr, idx) => {
            if (!dateStr) return <div key={`empty-${idx}`} className="h-10"></div>;

            const hasLog = getDayLogs(exerciseLogs, dateStr).length > 0;
            const isSelected = dateStr === selectedExerciseDate;

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedExerciseDate(dateStr)}
                className={`h-10 border rounded flex flex-col items-center justify-center relative cursor-pointer transition-colors
                  ${isSelected ? 'border-teal-500 bg-teal-50 font-bold text-teal-500' : 'border-transparent hover:bg-gray-50'}`}
              >
                <span className="text-[12px]">{parseInt(dateStr.slice(-2), 10)}</span>
                {hasLog && <div className="w-1.5 h-1.5 bg-teal-500 rounded-full absolute bottom-1"></div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="font-bold text-teal-500 mb-3">
          {selectedExerciseDate} 운동 기록
        </h2>

        {selectedLogs.length > 0 ? (
          <div className="space-y-2">
            {selectedLogs.map((log) => (
              <div
                key={log.id}
                onClick={() =>
                  openModal(
                    "exercise",
                    log,
                    selectedExerciseDate
                  )
                }
                className="bg-gray-50 border border-gray-100 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">
                    {log.name}
                  </span>

                  <span className="text-xs text-gray-500">
                    {formatExerciseMinutes(log.time)}
                  </span>
                </div>

                <div className="text-[11px] text-gray-400 mt-1">
                  {log.part}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-400 text-center py-4">
            기록 없음
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-[11px] font-bold text-gray-600 mb-3 text-center">주간 운동 부위 비율</h3>
          <div
            className="relative w-24 h-24 mx-auto rounded-full shadow-inner"
            style={{
              background: totalExTime > 0
                ? `conic-gradient(${partChartColors["상체"]} 0% ${upperPct}%, ${partChartColors["하체"]} ${upperPct}% ${upperPct + lowerPct}%, ${partChartColors["전신"]} ${upperPct + lowerPct}% 100%)`
                : "#f3f4f6",
            }}
          />
          <div className="flex flex-col gap-1 mt-4 text-[10px] items-center">
            {[
              { key: "상체", label: "상체" },
              { key: "하체", label: "하체" },
              { key: "전신", label: "전신" },
            ].map(({ key, label }) => (
              <span key={key} className="flex items-center">
                <span
                  className="w-2.5 h-2.5 rounded-sm mr-1.5 shrink-0"
                  style={{ backgroundColor: partChartColors[key] }}
                />
                {label} ({partStats[key]}분)
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-[11px] font-bold text-gray-600 mb-3">최근 7일 운동시간 분석</h3>
          <div className="space-y-1.5">
            {recent7Days.slice().reverse().map((date) => {
              const time = getDayLogs(exerciseLogs, date).reduce(
                (acc, log) => acc + parseNumericValue(log.time),
                0
              );
              const bgClass =
                time === 0
                  ? "bg-gray-100 text-gray-400"
                  : time < 30
                    ? "bg-teal-100 text-teal-500"
                    : time < 60
                      ? "bg-teal-300 text-teal-900"
                      : "bg-teal-500 text-white";

              return (
                <div key={date} className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500">{date.slice(5)}</span>
                  <span className={`px-2 py-0.5 rounded-sm font-medium w-12 text-center ${bgClass}`}>
                    {time}분
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
};

const renderAccount = () => {
  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        
        <h2 className="text-lg font-bold mb-4">
          {lastBackupTime && (
  <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 mb-4">
    <p className="text-xs text-teal-500 font-medium">
      마지막 Firebase 백업
    </p>

    <p className="text-sm font-bold text-teal-900 mt-1">
      {lastBackupTime}
    </p>
  </div>
)}
          계정 정보
        </h2>

        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-500 mb-1">
            로그인된 이메일
          </p>

          <p className="font-bold text-gray-800 break-all">
            {currentUser?.email}
          </p>
        </div>

       <button
  onClick={backupAllDataToFirebase}
  disabled={isCloudSyncing || !currentUser}
  className="w-full bg-gray-100 disabled:bg-gray-200 disabled:text-gray-400 text-gray-700 p-3 rounded-xl font-bold mb-3 border border-gray-200 hover:bg-gray-200 transition-colors"
>
  {isCloudSyncing ? '백업 중...' : '클라우드 백업'}
</button>

<button
  onClick={downloadAllCsv}
 className="w-full bg-gray-100 text-gray-700 p-3 rounded-xl font-bold mb-3 border border-gray-200 hover:bg-gray-200 transition-colors"
>
  전체 CSV 다운로드
</button>

<div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">

  <p className="text-sm font-bold text-gray-700 mb-3">
    CSV 업로드
  </p>

  <div className="space-y-2">

    <input
      type="file"
      accept=".csv"
      onChange={(e) => handleCsvImport(e, "diet")}
      className="hidden"
      id="diet-upload"
    />

    <label
      htmlFor="diet-upload"
      className="w-full bg-gray-100 text-gray-700 p-3 rounded-xl font-bold border border-gray-200 hover:bg-gray-200 transition-colors cursor-pointer flex items-center justify-center"
    >
      식단 CSV 업로드
    </label>

    <input
      type="file"
      accept=".csv"
      onChange={(e) => handleCsvImport(e, "weight")}
      className="hidden"
      id="weight-upload"
    />

    <label
      htmlFor="weight-upload"
      className="w-full bg-gray-100 text-gray-700 p-3 rounded-xl font-bold border border-gray-200 hover:bg-gray-200 transition-colors cursor-pointer flex items-center justify-center"
    >
      체중 CSV 업로드
    </label>

    <input
      type="file"
      accept=".csv"
      onChange={(e) => handleCsvImport(e, "exercise")}
      className="hidden"
      id="exercise-upload"
    />

    <label
      htmlFor="exercise-upload"
      className="w-full bg-gray-100 text-gray-700 p-3 rounded-xl font-bold border border-gray-200 hover:bg-gray-200 transition-colors cursor-pointer flex items-center justify-center"
    >
      운동 CSV 업로드
    </label>
<div className="mt-4 bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-500 leading-relaxed">

  <p className="font-bold text-gray-700 mb-2">
    CSV 업로드 형식 안내
  </p>

  <div className="space-y-3">

    <div>
      <p className="font-semibold text-gray-600">
        식단 CSV
      </p>

      <p>
        날짜 / 식사 / 메뉴 / 수량 / 칼로리 / 탄수화물 / 단백질 / 지방 / 첨가당
      </p>

      <p className="mt-1">
        예시:
        2026-05-21,아침,고구마,1,150~200,35~40,2~3,0,5
      </p>
    </div>

    <div>
      <p className="font-semibold text-gray-600">
        체중 CSV
      </p>

      <p>
        날짜 / 시간 / 체중 / 화장실 여부 / 메모
      </p>

      <p className="mt-1">
        예시:
        2026-05-21,08:30,51.2,true,컨디션 좋음
      </p>
    </div>

    <div>
      <p className="font-semibold text-gray-600">
        운동 CSV
      </p>

      <p>
        날짜 / 운동명 / 운동 부위 / 운동 종류 / 운동 시간
      </p>

      <p className="mt-1">
        예시:
        2026-05-21,스쿼트,하체,근력,30
      </p>
    </div>

    <div className="pt-2 border-t border-gray-100">
      <p>
        • CSV 파일(.csv)만 업로드 가능합니다.
      </p>

      <p>
        • CSV 파일 업로드 시 해당 항목의 기존 데이터는 삭제되고, 업로드한 파일 내용으로 덮어씌워집니다.
      </p>

      <p>
        • 첫 줄 헤더와 컬럼 순서를 유지해주세요.
      </p>

      <p>
        • 칼로리/탄단지는 150 또는 150~200 형태 모두 가능합니다.
      </p>
    </div>

  </div>
</div>
  </div>
</div>

<button
  onClick={handleLogout}
 className="w-full bg-teal-500 text-white p-3 rounded-xl font-bold mb-3"
  >
  로그아웃
</button>
      </div>
    </div>
  );
};

  const renderDatabase = () => { 
     const handleAddRecipe = async (e) => {
       e.preventDefault();
       if(recipeForm.ingredients.length === 0) return showAlert("재료를 추가해주세요.");
       const totalNutrition = recipeForm.ingredients.reduce((acc, item) => {
         const info = nutritionDB[item.menu];
         return {
           kcal: acc.kcal + (getNutritionValue(info.kcal) * item.qty), carb: acc.carb + (getNutritionValue(info.carb) * item.qty),
           protein: acc.protein + (getNutritionValue(info.protein) * item.qty), fat: acc.fat + (getNutritionValue(info.fat) * item.qty), sugar: acc.sugar + (getNutritionValue(info.sugar) * item.qty)
         };
       }, { kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0 });
       
       const newDB = {...nutritionDB};
       if(dbEditingKey && dbEditingKey !== recipeForm.name) delete newDB[dbEditingKey];
       newDB[recipeForm.name] = {
         kcal: Number(totalNutrition.kcal.toFixed(1)), carb: Number(totalNutrition.carb.toFixed(1)),
         protein: Number(totalNutrition.protein.toFixed(1)), fat: Number(totalNutrition.fat.toFixed(1)), sugar: Number(totalNutrition.sugar.toFixed(1))
       };
       setNutritionDB(newDB);
       try {
         if (dbEditingKey && dbEditingKey !== recipeForm.name) {
           await deletePersonalDbItem('nutrition', dbEditingKey);
         }
         await savePersonalNutritionItem(recipeForm.name, newDB[recipeForm.name], 'recipe', publishToSharedDb);
       } catch (error) {
         console.error('Save recipe to Firestore failed:', error);
         showAlert('로컬에는 저장했지만 Firestore 저장에 실패했습니다.');
         return;
       }
       setRecipeForm({ name: '', ingredients: [] });
       setDbEditingKey(null);
       setPublishToSharedDb(true);
       showAlert("레시피가 저장되었습니다!");
     };
 
     const handleAddSingleItem = async (e) => {
       e.preventDefault();
       const invalidField = NUTRITION_FIELDS.find((field) => !isValidNutritionInput(singleItemForm[field]));
       if (invalidField) {
         showAlert('영양소 값은 3, 3.5, 3~5 형태로 입력해주세요.');
         return;
       }
       const newDB = {...nutritionDB};
       if(dbEditingKey && dbEditingKey !== singleItemForm.name) delete newDB[dbEditingKey];
       newDB[singleItemForm.name] = {
         kcal: normalizeRangeInput(singleItemForm.kcal), carb: normalizeRangeInput(singleItemForm.carb),
         protein: normalizeRangeInput(singleItemForm.protein), fat: normalizeRangeInput(singleItemForm.fat), sugar: normalizeRangeInput(singleItemForm.sugar)
       };
       setNutritionDB(newDB);
       try {
         if (dbEditingKey && dbEditingKey !== singleItemForm.name) {
           await deletePersonalDbItem('nutrition', dbEditingKey);
         }
         await savePersonalNutritionItem(singleItemForm.name, newDB[singleItemForm.name], 'single', publishToSharedDb);
       } catch (error) {
         console.error('Save nutrition item to Firestore failed:', error);
         showAlert('로컬에는 저장했지만 Firestore 저장에 실패했습니다.');
         return;
       }
       setSingleItemForm({ name: '', kcal: '', carb: '', protein: '', fat: '', sugar: '' });
       setDbEditingKey(null);
       showAlert(dbEditingKey ? "식재료가 수정되었습니다!" : "개별 재료가 저장되었습니다!");
     };
 
     const handleAddExercise = async (e) => {
       e.preventDefault();
       const newDB = {...exerciseDB};
       if(dbEditingKey && dbEditingKey !== newExerciseForm.name) delete newDB[dbEditingKey];
       newDB[newExerciseForm.name] = {
         part: newExerciseForm.part, type: newExerciseForm.type, time: Number(newExerciseForm.time) || 0
       };
       setExerciseDB(newDB);
       try {
         if (dbEditingKey && dbEditingKey !== newExerciseForm.name) {
           await deletePersonalDbItem('exercise', dbEditingKey);
         }
         await savePersonalExerciseItem(newExerciseForm.name, newDB[newExerciseForm.name], publishToSharedDb);
       } catch (error) {
         console.error('Save exercise item to Firestore failed:', error);
         showAlert('로컬에는 저장했지만 Firestore 저장에 실패했습니다.');
         return;
       }
       setNewExerciseForm({ name: '', part: '전신', type: '유산소', time: '' });
       setDbEditingKey(null);
       showAlert(dbEditingKey ? "운동 DB가 수정되었습니다!" : "새로운 운동이 DB에 저장되었습니다!");
     };
 
     const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
     const publishControl = (
       <label className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
         <input
           type="checkbox"
           checked={publishToSharedDb}
           onChange={(e) => setPublishToSharedDb(e.target.checked)}
           className="mt-0.5 w-4 h-4 text-teal-500 rounded"
         />
         <span className="text-xs text-gray-600 leading-relaxed">
           <span className="font-bold text-gray-800">공유 DB에도 공개</span><br />
           체크하면 다른 사용자가 검색해서 가져올 수 있습니다.
         </span>
       </label>
     );
 
     return (
       <div className="space-y-6 pb-20 animate-fade-in">
         <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={()=>{cancelDbEdit(); setDbMode('recipe');}} className={`flex-1 py-2 text-xs font-bold rounded-lg ${dbMode === 'recipe' ? 'bg-white shadow-sm text-teal-500' : 'text-gray-500'}`}>레시피 등록</button>
            <button onClick={()=>{cancelDbEdit(); setDbMode('single');}} className={`flex-1 py-2 text-xs font-bold rounded-lg ${dbMode === 'single' ? 'bg-white shadow-sm text-teal-500' : 'text-gray-500'}`}>{dbEditingKey ? '식재료 수정' : '식재료 등록'}</button>
            <button onClick={()=>{cancelDbEdit(); setDbMode('exercise');}} className={`flex-1 py-2 text-xs font-bold rounded-lg ${dbMode === 'exercise' ? 'bg-white shadow-sm text-teal-500' : 'text-gray-500'}`}>{dbEditingKey ? '운동 수정' : '운동 등록'}</button>
         </div>
         
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           {dbMode === 'recipe' && (
             <div className="space-y-6 animate-fade-in">
               <form onSubmit={handleAddRecipe} className="space-y-4">
                 <div>
                   <label className="text-xs font-semibold text-gray-600 block mb-1">수동 레시피 이름</label>
                   <input type="text" value={recipeForm.name} onChange={e => setRecipeForm({...recipeForm, name: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="예: 양배추 참치 볶음" required />
                 </div>
                 <div className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300 overflow-hidden">
                   <label className="text-xs font-semibold text-gray-600 block mb-2">기존 재료 추가</label>
                   <div className="flex flex-wrap items-stretch gap-2 mb-2 w-full">
                     <select
                       value={newIngredient.menu}
                       onChange={e => setNewIngredient({...newIngredient, menu: e.target.value})}
                       className="flex-1 min-w-0 basis-[calc(100%-5.5rem)] p-2 border rounded-md text-sm bg-white truncate"
                     >
                       {Object.keys(nutritionDB).length === 0 ? (
                         <option value="">등록된 재료 없음</option>
                       ) : (
                         Object.keys(nutritionDB).map(menu => <option key={menu} value={menu}>{menu}</option>)
                       )}
                     </select>
                     <input
                       type="number"
                       step="0.5"
                       value={newIngredient.qty}
                       onChange={e => setNewIngredient({...newIngredient, qty: e.target.value})}
                       className="w-14 shrink-0 p-2 border rounded-md text-sm bg-white"
                     />
                     <button
                       type="button"
                       disabled={!newIngredient.menu}
                       onClick={() => {
                         if (!newIngredient.menu) return;
                         setRecipeForm({...recipeForm, ingredients: [...recipeForm.ingredients, {menu: newIngredient.menu, qty: Number(newIngredient.qty)}]});
                       }}
                       className="shrink-0 bg-teal-100 text-teal-500 px-4 rounded-md text-sm font-bold disabled:opacity-40"
                     >
                       +
                     </button>
                   </div>
                   <ul className="space-y-1">
                     {recipeForm.ingredients.map((ing, idx) => (
                       <li key={idx} className="text-xs flex justify-between bg-white p-2 rounded border">
                         <span>{ing.menu}</span> <span className="font-medium text-gray-500">x{ing.qty}</span>
                       </li>
                     ))}
                   </ul>
                 </div>
                 {publishControl}
                 <button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-xl text-sm">재료 추가</button>
               </form>
             </div>
           )}
 
           {dbMode === 'single' && (
             <form onSubmit={handleAddSingleItem} noValidate className="space-y-3 animate-fade-in">
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
                       <input type="text" inputMode="text" value={singleItemForm[field] ?? ''} onChange={e => setSingleItemForm({...singleItemForm, [field]: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="예: 3, 3.5, 3~5" required />
                     </div>
                   )
                 })}
               </div>
               {publishControl}
               <div className="flex gap-2 mt-4">
                 {dbEditingKey && (
                    <button type="button" onClick={handleDeleteDbItem} className="w-1/4 bg-red-100 text-red-600 font-bold py-3 rounded-xl text-sm flex justify-center items-center"><Trash2 size={16}/></button>
                 )}
                 {dbEditingKey && (
                    <button type="button" onClick={cancelDbEdit} className="w-1/4 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm">취소</button>
                 )}
                 <button type="submit" className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-xl text-sm">{dbEditingKey ? '수정 완료' : '식재료 추가'}</button>
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
                 {publishControl}
                 <div className="flex gap-2 mt-4">
                   {dbEditingKey && (
                      <button type="button" onClick={handleDeleteDbItem} className="w-1/4 bg-red-100 text-red-600 font-bold py-3 rounded-xl text-sm flex justify-center items-center"><Trash2 size={16}/></button>
                   )}
                   {dbEditingKey && (
                      <button type="button" onClick={cancelDbEdit} className="w-1/4 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm">취소</button>
                   )}
                   <button type="submit" className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-xl text-sm">{dbEditingKey ? '운동 정보 수정' : '운동 추가'}</button>
                 </div>
               </form>
 
               {!dbEditingKey && (
                 <div className="pt-6 border-t border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
                      <Calendar size={16} className="mr-1.5 text-teal-500"/> 주간 운동 계획 설정
                    </h3>
                    <div className="flex justify-between bg-gray-100 p-1 rounded-lg mb-3">
                      {dayLabels.map((d, i) => (
                        <button key={i} type="button" onClick={() => setSelectedPlanDay(i)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${selectedPlanDay === i ? 'bg-white shadow-sm text-teal-500' : 'text-gray-500 hover:bg-gray-200'}`}>
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
                            <label key={ex} className={`flex items-center bg-white p-2.5 rounded-xl border transition-colors cursor-pointer ${isChecked ? 'border-teal-400 bg-teal-50/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                              <input type="checkbox" checked={isChecked} onChange={(e) => {
                                const currentPlan = weeklyExercisePlan[selectedPlanDay] ? [...weeklyExercisePlan[selectedPlanDay]] : [];
                                if(e.target.checked) {
                                  setWeeklyExercisePlan({...weeklyExercisePlan, [selectedPlanDay]: [...currentPlan, ex]});
                                } else {
                                  setWeeklyExercisePlan({...weeklyExercisePlan, [selectedPlanDay]: currentPlan.filter(item => item !== ex)});
                                }
                              }} className="w-4 h-4 text-teal-500 rounded mr-3" />
                              <span className={`text-xs font-bold ${isChecked ? 'text-teal-500' : 'text-gray-700'}`}>{ex}</span>
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
           <h2 className="text-base font-bold text-gray-800 mb-3 border-b pb-2 flex items-center">
             <Database size={16} className="mr-2 text-gray-500"/>공유 DB 검색
           </h2>
           <div className="flex gap-2 mb-3">
             <input
               type="text"
               value={sharedSearchTerm}
               onChange={(e) => setSharedSearchTerm(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') searchSharedDb(); }}
               className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-300"
               placeholder={dbMode === 'exercise' ? '다른 사용자의 운동 검색' : '다른 사용자의 음식/레시피 검색'}
             />
             <button
               type="button"
               onClick={searchSharedDb}
               disabled={isSharedLoading || !isFirestoreReady}
               className="px-4 py-2 bg-gray-900 disabled:bg-gray-300 text-white rounded-lg text-xs font-bold"
             >
               {isSharedLoading ? '검색중' : '검색'}
             </button>
           </div>
           <p className="text-[10px] text-gray-400 mb-3 font-medium">
             공개 옵션을 체크한 항목만 공유 DB에 등록됩니다. 검색한 항목은 가져오기로 내 DB에 복사할 수 있습니다.
           </p>
           <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
             {sharedResults.length === 0 ? (
               <p className="text-xs text-gray-400 text-center py-4">
                 {isFirestoreReady ? '검색어를 입력하거나 검색 버튼을 눌러 최신 공유 항목을 확인하세요.' : 'Firestore 연결 준비 중입니다.'}
               </p>
             ) : sharedResults.map((item) => (
               <div key={item.id} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                 <div className="min-w-0 flex-1">
                   <div className="flex items-center gap-1">
                     <span className="font-bold text-sm text-gray-800 truncate">{item.name}</span>
                     {item.ownerId === currentUser?.uid && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">내 항목</span>}
                   </div>
                   {item.dbKind === 'exercise' ? (
                     <p className="text-[10px] text-gray-500">{item.part}/{item.type} · {Number(item.time) > 0 ? `${item.time}분` : '자유시간'}</p>
                   ) : (
                     <p className="text-[10px] text-gray-500">{item.kcal}kcal · C:{item.carb} P:{item.protein} F:{item.fat} S:{item.sugar}</p>
                   )}
                 </div>
                 <button
                   type="button"
                   onClick={() => importSharedItem(item)}
                   className="shrink-0 bg-teal-100 text-teal-500 px-3 py-2 rounded-lg text-xs font-bold"
                 >
                   가져오기
                 </button>
               </div>
             ))}
           </div>
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
                     <span className="text-[11px] font-bold text-teal-500">{formatExerciseMinutes(info.time)}</span>
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
             {modalType === 'dday-start' ? <><Calendar className="mr-2 text-[#60a5fa]"/> 다이어트 시작일 설정</> :
              modalType === 'dday-goal' ? <><Calendar className="mr-2 text-[#f87171]"/> 다이어트 목표일 설정</> :
              modalType === 'goals' ? <><Settings className="mr-2 text-gray-700"/> 목표 영양소 설정</> :
              modalType === 'diet' ? <><Utensils className="mr-2 text-yellow-800"/> 식단 {editingLogId ? '수정' : '기록'}</> :
              modalType === 'weight' ? <><Scale className="mr-2 text-teal-500"/> 체중 {editingLogId ? '수정' : '기록'}</> :
              <><Dumbbell className="mr-2 text-teal-500"/> 운동 {editingLogId ? '수정' : '기록'}</>}
           </h2>
 
           <form onSubmit={submitLog} className="space-y-5">
             {modalType === 'dday-start' && (
               <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">다이어트 시작일</label>
                   <input type="date" name="ddayStartDate" value={formData.ddayStartDate} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#60a5fa]/50" required />
                 </div>
               </div>
             )}

             {modalType === 'dday-goal' && (
               <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">다이어트 목표일</label>
                   <input type="date" name="ddayGoalDate" value={formData.ddayGoalDate} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f87171]/50" required />
                 </div>
               </div>
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
                   <input type="number" name="goalCarb" value={formData.goalCarb} onChange={handleInputChange} className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-300" required />
                   <span className="text-xs text-gray-500 w-8">g</span>
                 </div>
                 <div className="flex justify-between items-center gap-4">
                   <label className="text-sm font-bold text-gray-700 w-24">단백질</label>
                   <input type="number" name="goalProtein" value={formData.goalProtein} onChange={handleInputChange} className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-300" required />
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
                   <select name="meal" value={formData.meal} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-yellow-300">
                     <option value="아침">아침</option><option value="점심">점심</option><option value="저녁">저녁</option><option value="간식">간식</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">메뉴명 (DB에서 선택)</label>
                   <select name="menu" value={formData.menu} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-yellow-300">
                     {Object.keys(nutritionDB).map(menu => <option key={menu} value={menu}>{menu}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">수량 (개/인분)</label>
                   <input type="number" name="qty" step="0.1" value={formData.qty} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-yellow-300" required />
                 </div>
               </>
             )}
 
             {modalType === 'weight' && (
               <>
                 <div className="flex gap-4">
                   <div className="flex-1">
                     <label className="block text-sm font-bold text-gray-700 mb-1">체중 (kg)</label>
                     <input type="number" name="weight" step="0.01" value={formData.weight} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-teal-500 outline-none focus:ring-2 focus:ring-teal-300" placeholder="0.00" required />
                   </div>
                   <div className="flex-1">
                     <label className="block text-sm font-bold text-gray-700 mb-1">측정 시간</label>
                     <input type="time" name="time" value={formData.time} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-300" required />
                   </div>
                 </div>
                 <div className="flex items-center p-3 bg-red-50 border border-red-100 rounded-xl">
                   <input type="checkbox" name="restroom" id="restroom" checked={formData.restroom} onChange={handleInputChange} className="w-5 h-5 text-red-500 rounded cursor-pointer" />
                   <label htmlFor="restroom" className="ml-3 font-semibold text-red-700 cursor-pointer w-full">화장실 다녀옴 (✔)</label>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">메모 (선택)</label>
                   <input type="text" name="memo" value={formData.memo} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-300 placeholder-gray-400" placeholder="예: 어제 야식 먹음, 생리 시작 등" />
                 </div>
               </>
             )}
 
             {modalType === 'exercise' && (
               <>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">운동명 (DB에서 선택)</label>
                   <select name="exerciseName" value={formData.exerciseName} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-300">
                     {Object.keys(exerciseDB).map(ex => <option key={ex} value={ex}>{ex} ({exerciseDB[ex].part})</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">진행 시간 (분)</label>
                   <input type="number" name="exTime" value={formData.exTime} onChange={handleInputChange} 
                          placeholder={exerciseDB[formData.exerciseName]?.time === 0 ? "시간을 직접 입력해주세요" : ""}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-300 placeholder-gray-400" required />
                   {exerciseDB[formData.exerciseName]?.time === 0 && (
                     <p className="text-[10px] text-teal-500 mt-1">* 자유 운동입니다. 진행 시간을 직접 입력해주세요.</p>
                   )}
                 </div>
               </>
             )}
 
             <div className="flex gap-3 mt-4">
                {editingLogId && !modalType.startsWith('dday') && modalType !== 'goals' && (
                  <button type="button" onClick={deleteLog} className="w-1/4 bg-red-100 hover:bg-red-200 text-red-600 font-bold py-4 rounded-xl transition duration-200 flex justify-center items-center">
                    <Trash2 size={20} />
                  </button>
                )}
                <button type="submit" className={`flex-1 font-bold py-4 rounded-xl transition duration-200 text-lg shadow-lg ${
                  modalType === 'diet'
                    ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-200'
                    : 'bg-teal-500 hover:bg-teal-600 text-white'
                }`}>
                  {modalType.startsWith('dday') || modalType === 'goals' ? '설정 저장' : (editingLogId ? '수정 완료' : '기록 저장')}
                </button>
             </div>
           </form>
         </div>
       </div>
     );
   };
 
  if (showSplash) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center">
        <div className="text-center animate-fade-in px-8">
          <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl animate-splash-pulse">
            <Activity size={52} className="text-teal-600" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Health Log</h1>
          <p className="text-teal-100 text-sm mt-2 font-medium">건강 기록을 한곳에서</p>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in { animation: fadeIn 0.6s ease-out; }
        `}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex justify-center relative">
      <div className="w-full max-w-md bg-white relative h-screen overflow-y-auto shadow-2xl">
        {renderHeader()}

        <main className="p-5">
          {activeTab === 'home' && renderDashboard()}
          {activeTab === 'diet' && renderDiet()}
          {activeTab === 'weight' && renderWeight()}
          {activeTab === 'exercise' && renderExercise()}
          {activeTab === 'database' && renderDatabase()}
          {activeTab === 'account' && renderAccount()}
        </main>

        <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 flex justify-around items-center pb-safe z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {[
            { id: 'home', icon: Home, label: '메인' },
            { id: 'diet', icon: Utensils, label: '식단' },
            { id: 'weight', icon: Scale, label: '체중' },
            { id: 'exercise', icon: Dumbbell, label: '운동' },
            { id: 'database', icon: Database, label: 'DB' },
            { id: 'account', icon: Settings, label: '계정' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-3 w-full transition-colors ${
                activeTab === tab.id
                  ? 'text-teal-500'
                  : 'text-gray-400 hover:text-teal-500'
              }`}
            >
              <tab.icon size={22} className={`mb-1 ${activeTab === tab.id ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </button>
          ))}
        </nav>
        {renderModal()}
      </div>
{showAuthModal && (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6">
    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
      
      <h2 className="text-2xl font-bold mb-2 text-center">
        로그인
      </h2>

      <p className="text-sm text-gray-500 text-center mb-5">
        계정으로 데이터를 안전하게 저장하세요
      </p>

      <div className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-gray-200 p-3 rounded-xl"
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-200 p-3 rounded-xl"
        />

        <button
          onClick={handleLogin}
          className="bg-teal-500 hover:bg-teal-600 text-white p-3 rounded-xl font-bold"
        >
          로그인
        </button>

        <button
          onClick={handleSignup}
          className="bg-gray-100 text-gray-800 p-3 rounded-xl font-bold"
        >
          회원가입
        </button>
      </div>
    </div>
  </div>
)}
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
                      className="flex-1 py-3 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-600 transition-colors shadow-md">
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
